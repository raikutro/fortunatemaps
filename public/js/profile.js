let renderedMarkdown = marked(document.getElementById('bioText').attributes.markdown.value);
let cleanMarkdown = DOMPurify.sanitize(renderedMarkdown);

document.getElementById('bioText').innerHTML = cleanMarkdown;