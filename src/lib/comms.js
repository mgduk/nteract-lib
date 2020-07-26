import * as Ably from 'ably';
import sleep from 'sleep-promise';

class Comms {
  init({
    me,
    token,
    authUrl,
    presenceData = {},
    broadcastHandler,
    responseHandler,
    presenceEnter,
    presenceUpdate,
    presenceLeave,
  }) {
    this.me = me;
    this.defaultPresenceData = presenceData;
    this.broadcastHandler = broadcastHandler;
    this.responseHandler = responseHandler;
    this.presenceEnter = presenceEnter;
    this.presenceUpdate = presenceUpdate;
    this.presenceLeave = presenceLeave;

    this.reset();

    this.ably = new Ably.Realtime({
      token,
      authUrl,
      clientId: me.id,
    });

    this.ably.connection.on(() =>
      this.checkConnection().catch(err => this.handleConnectionError(err))
    );

    this.initialized = true;
  }

  handleConnectionError(err) {
    throw Error(err);
  }

  reset() {
    this._presenceData = {
      type: 'user',
      ...this.defaultPresenceData,
    };
    if (this.initialized) {
      this.stop();
    }
  }

  checkConnection() {
    return new Promise((resolve, reject) =>
      (async () => {
        let waits = 0;
        if (this.ably == null || this.ably.connection == null) {
          reject('No Ably client or connection available');
          return;
        }
        while (true) {
          switch (this.ably.connection.state) {
            case 'disconnected':
            case 'connected':
              resolve();
              return;
            case 'initialized':
            case 'connecting':
              waits++;
              if (waits > 20) {
                reject('Timed out connecting to Ably');
                return;
              }
              await sleep(1000);
              break;
            case 'suspended':
            case 'closing':
            case 'closed':
            case 'failed':
            default:
              reject('Disconnected from Ably');
              return;
          }
        }
      })()
    );
  }

  presenceData(updates = {}) {
    this._presenceData = { ...this._presenceData, ...updates };
    return this._presenceData;
  }

  async start(name, host = false) {
    await this.checkConnection();

    this.broadcastChannel = this.ably.channels.get('broadcast:all');
    this.privateChannel = this.ably.channels.get(`broadcast:${this.me.id}`);
    this.responseChannel = this.ably.channels.get('response');

    this.broadcastChannel.subscribe(this.broadcastHandler);
    this.privateChannel.subscribe(this.broadcastHandler);

    if (host) {
      this.responseChannel.subscribe(this.responseHandler);
      this.responseChannel.presence.subscribe('enter', this.presenceEnter);
      this.responseChannel.presence.subscribe('update', this.presenceUpdate);
      this.responseChannel.presence.subscribe('leave', this.presenceLeave);
    }

    this.responseChannel.presence.enter(this.presenceData({ name }));

    this.started = true;
  }

  updatePresenceData(data) {
    if (this.responseChannel) {
      this.responseChannel.presence.update(this.presenceData(data));
    }
  }

  stop() {
    if (this.started) {
      this.broadcastChannel.unsubscribe(this.broadcastHandler);
      this.privateChannel.unsubscribe(this.broadcastHandler);
      this.responseChannel.unsubscribe(this.responseHandler);
      this.responseChannel.presence.unsubscribe('enter', this.presenceEnter);
      this.responseChannel.presence.unsubscribe('update', this.presenceUpdate);
      this.responseChannel.presence.unsubscribe('leave', this.presenceLeave);
      this.responseChannel.presence.leave();
    }
    if (this.ably && this.ably.connection) {
      this.ably.connection.close();
    }
    this.started = false;
  }

  getUsers() {
    return new Promise((resolve, reject) => {
      this.responseChannel.presence.get((err, users) => {
        if (err != null) {
          return reject(err);
        }
        resolve(users.map(u => ({ ...u, userId: u.clientId })));
      });
    })
  }

  send(type, data) {
    this.responseChannel.publish(type, data);
  }

  sendMessage(message, context) {
    this.responseChannel.publish('response', { message, context });
  }

  broadcast(command, context) {
    this.broadcastChannel.publish(command, context);
  }

  sendPrivateMessage(clientId, command, context) {
    const channel = this.ably.channels.get(`broadcast:${clientId}`);
    channel.publish(command, context);
  }
}

export default Comms;
