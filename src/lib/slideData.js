import ky from 'ky';

const FREE_TEXT_REGEX = /\bfree\s+text\b/i;

class SlideData {
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
    const checklist = data.checklists
      .filter(({ id }) => idChecklists.includes(id))
      .find(({ name }) => name.toLowerCase() === 'choices');
    if (!checklist) {
      return undefined;
    }
    return checklist.checkItems.map(({ name }) => name);
  }

  getImages(attachments, data) {
    return attachments
      .filter(({ mimeType }) => /^image\//i.test(mimeType))
      .map(({ previews }) => previews[4]);
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

  async load(boardUrl) {
    this.reset();
    const json = await ky.get(boardUrl).json();

    return {
      slideSets: this.extractSlides(json),
      activeSlideId: this.activeCardId,
    };
  }
}

export default SlideData;
