class TagInput {
	constructor({
		displayElem,
		input,
		addButton,
		colorKey,
		addTagConditionFunction
	}) {
		this.tags = [];

		this.displayElem = displayElem;
		this.input = input;
		this.addButton = addButton;
		this.colorKey = colorKey;
		this.addTagConditionFunction = addTagConditionFunction || (() => true);

		this.addButton.click(() => {
			let tagName = this.input.val().trim();
			if(tagName.length === 0) return;

			if(!this.addTagConditionFunction(tagName)) return;

			this.addTag(tagName);

			this.input.val("");
		});
	}

	init(tags) {
		this.tags = tags;
		this.renderTags(this.tags);
		return this;
	}

	addTag(name) {
		if(this.tags.length >= SETTINGS.SITE.MAX_TAGS) return;
		if(this.tags.findIndex(a => (a.name === name && name !== null)) > -1) return;

		this.tags.push(name);

		this.renderTags(this.tags);

		return this;
	}

	deleteTag(index) {
		this.tags.splice(index, 1);

		this.renderTags(this.tags);

		return this;
	}

	renderTags(tagList) {
		this.displayElem.empty();

		if(tagList.length === 0) this.displayElem.append(`None`);

		tagList.forEach(tag => {
			// console.log(tag);

			if(this.colorKey && this.colorKey[tag.toUpperCase()]){
				let tagData = this.colorKey[tag.toUpperCase()];

				this.displayElem.append(`
					<span class="tag badge badge-primary"
						style="background: ${tagData.backgroundColor}; color: ${tagData.textColor}"
					>${tagData.name}</span>`);
			} else {
				this.displayElem.append(`<span class="tag badge badge-primary">${tag}</span>`);
			}
		});

		this.resetEventHandlers();

		return tagList;
	}

	resetEventHandlers() {
		const self = this;
		this.displayElem.find(".tag").click(function(){
			let tagIndex = $(this).index();
			self.deleteTag(tagIndex);
		});
	}
}