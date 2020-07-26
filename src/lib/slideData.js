import ky from 'ky';
import Promise from 'bluebird';

const FREE_TEXT_REGEX = /\bfree\s+text\b/i;

class SlideData {
  setTrelloAuth(trelloKey, trelloToken) {
    this.trelloKey = trelloKey;
    this.trelloToken = trelloToken;
  }

  assertToken() {
    if (!this.trelloKey) {
      throw Error('This requires a Trello API key');
    }
    if (!this.trelloToken) {
      throw Error('This requires a Trello API token');
    }
  }

  checkIfActive(id, labels) {
    const active = labels.some(label => label.name.toLowerCase() === 'active');
    if (active) {
      this.setActiveSlide(id);
    }
  }

  setActiveSlide(id) {
    this.activeCardId = id;
  }

  getChoices(idChecklists, data) {
    // use the first checklist on the card
    const checklist = data.checklists.filter(({ id }) => idChecklists.includes(id))[0];
    if (!checklist) {
      return undefined;
    }
    return checklist.checkItems.map(({ name }) => name);
  }

  getImages(attachments, data) {
    return attachments
      .filter(({ mimeType }) => /^image\//i.test(mimeType))
      .map(({ previews, name }) => {
        const image = previews[4];
        return {
          ...image,
          ratio: image.width / image.height,
          name,
        };
      });
  }

  getFreeTextResponseFieldId(data) {
    if (!this.freeTextResponseFieldId) {
      const field = data.customFields.find(({ name, type }) =>
        type === 'checkbox' && FREE_TEXT_REGEX.test(name)
      );
      this.freeTextResponseFieldId = field ? field.id : null;
    }
    return this.freeTextResponseFieldId;
  }

  isFreeTextResponse(customFieldItems, data) {
    const fieldId = this.getFreeTextResponseFieldId(data);
    return customFieldItems.some(o =>
      o.idCustomField === fieldId && o.value.checked === 'true'
    );
  }

  getSlideDataFromCard(card, data) {
    this.checkIfActive(card.id, card.labels);
    return {
      id: card.id,
      title: card.name,
      body: card.desc,
      images: this.getImages(card.attachments, data),
      choices: this.getChoices(card.idChecklists, data),
      freeTextResponse: this.isFreeTextResponse(card.customFieldItems, data),
    };
  }

  getCardsForList(list, data) {
    list.slides = data.cards
      .filter(card => card.idList === list.id)
      .map(card => this.getSlideDataFromCard(card, data));
    return list;
  }

  extractSlides(data) {
    return data.lists
      .filter(({ name }) => !name.match(/\*/) )
      .map(({ name, id }) => ({ name, id }))
      .map(list => this.getCardsForList(list, data));
  }

  reset() {
    this.setActiveSlide(undefined);
  }

  loadBoardData() {
    return ky.get(this.boardUrl).json();
  }

  async load(boardUrl) {
    this.reset();
    this.boardUrl = boardUrl;
    const json = await this.loadBoardData();

    return {
      slideSets: this.extractSlides(json),
      activeSlideId: this.activeCardId,
    };
  }

  async persistActiveSlide(activeCardId = null) {
    this.assertToken();
    const key = this.trelloKey;
    const token = this.trelloToken;

    const boardData = await this.loadBoardData();

    // POST /1/cards/{id}/idLabels?value=idLabel
    // DELETE /1/cards/{id}/idLabels/{idLabel}
    const activeCards = boardData.cards.map((card) => {
      const activeLabel = card.labels.find(label => label.name.toLowerCase() === 'active');
      return activeLabel ? [card.id, activeLabel.id] : null;
    }).filter(Boolean);

    try {
      await Promise.map(activeCards, ([ cardId, labelId ]) =>
        ky.delete(`https://api.trello.com/1/cards/${cardId}/idLabels/${labelId}`, {
          searchParams: { key, token }
        })
      );
    } catch (error) {
      console.error(error);
      // just squash errors, hopefully it'll self heal next time
    }

    if (activeCardId) {
      const activeLabel = boardData.labels
        .find(label => label.name.toLowerCase() === 'active');
      if (!activeLabel) {
        throw Error('There must be a label called ‘Active’ on the board');
      }
      await ky.post(`https://api.trello.com/1/cards/${activeCardId}/idLabels`, {
        searchParams: {
          value: activeLabel.id,
          key,
          token,
        }
      });
    }
  }
}

export default SlideData;
