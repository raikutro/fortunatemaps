let renderedMarkdown = marked.parse(document.getElementById('bioText').attributes.markdown.value);
let cleanMarkdown = DOMPurify.sanitize(renderedMarkdown);

document.getElementById('bioText').innerHTML = cleanMarkdown;

$(".btn.btn-primary[href^='/preview/']").text("Preview");

$("#runProfileActionBtn").click(() => {
	const action = $("#profileActionSelect").val();
	if (action === "manage_certs") {
		$("#manageCertsModal").modal("show");
	}
});

window.manageMtcAction = function(actionType, targetUserId) {
    // Only accept 'add' or 'revoke' per API expectations
	if (actionType !== 'add' && actionType !== 'revoke') return;

	fetch("/api/action/manage_mtc", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-CSRF-Token": getCsrfToken()
		},
		body: JSON.stringify({
			targetProfileId: targetUserId,
			certId: 2, 
			action: actionType
		})
	}).then(a => a.json()).then(json => {
		if (json.err) return alert("Error: " + json.err);
		if (!json.success) return alert("Error: Action failed completely.");

		location.reload();
	});
};