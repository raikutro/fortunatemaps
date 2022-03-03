let renderedMarkdown = marked.parse(document.getElementById('bioText').attributes.markdown.value);
let cleanMarkdown = DOMPurify.sanitize(renderedMarkdown);

document.getElementById('bioText').innerHTML = cleanMarkdown;

$(".btn.btn-primary[href^='/preview/']").text("Preview")