import * as Ably from 'ably';
import sleep from 'sleep-promise';

class Comms {
  init({
    clientId,
    token,
    authUrl,
    broadcastHandler,
    responseHandler,
    presenceEnter,
    presenceUpdate,
    presenceLeave,
  }) {
    this.reset();

    this.clientId = clientId;
    this.broadcastHandler = broadcastHandler;
    this.responseHandler = responseHandler;
    this.presenceEnter = presenceEnter;
    this.presenceUpdate = presenceUpdate;
    this.presenceLeave = presenceLeave;

    this.ably = new Ably.Realtime({
      token,
      authUrl,
      clientId,
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
    };
    if (this.initialized) {
      this.stop();
    }
  }

  checkConnection() {
    return new Promise((resolve, reject) =>
      (async () => {
        let waits = 0;
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
    return JSON.stringify(this._presenceData);
  }

  async start(name, host = false) {
    await this.checkConnection();

    this.broadcastChannel = this.ably.channels.get('broadcast');
    this.responseChannel = this.ably.channels.get('response');

    this.broadcastChannel.subscribe(this.broadcastHandler);

    if (host) {
      this.responseChannel.subscribe(this.responseHandler);
      this.responseChannel.presence.subcribe('enter', this.presenceEnter);
      this.responseChannel.presence.subcribe('update', this.presenceUpdate);
      this.responseChannel.presence.subcribe('leave', this.presenceLeave);
    }

    this.responseChannel.presence.enter(this.presenceData({ name }));
  }

  updatePresenceData(data) {
    if (this.responseChannel) {
      this.responseChannel.presence.update(this.presenceData(data));
    }
  }

  stop() {
    this.broadcastChannel.unsubscribe(this.broadcastHandler);
    this.responseChannel.unsubscribe(this.responseHandler);
    this.responseChannel.presence.unsubcribe('enter', this.presenceEnter);
    this.responseChannel.presence.unsubcribe('update', this.presenceUpdate);
    this.responseChannel.presence.unsubcribe('leave', this.presenceLeave);
    this.responseChannel.presence.leave();
    this.ably.connection.close();
  }

  getUsers() {
    return new Promise((resolve, reject) => {
      this.responseChannel.presence.get((err, users) => {
        if (err != null) {
          return reject(err);
        }
        resolve(users);
      });
    })
  }

  send(type, data) {
    this.responseChannel.publish(type, data);
  }

  sendMessage(message, context) {
    this.responseChannel.publish('response', { message, context });
  }
}

export default Comms;
