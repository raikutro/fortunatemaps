let currentSearchUsers = {};
let currentEditingUser = null;

$(document).ready(function() {
    $("#searchUserForm").on("submit", function(e) {
        e.preventDefault();
        const q = $("#userSearchInput").val().trim();
        if (q.length < 2) return alert("Search query must be at least 2 characters.");

        $("#userResultsTable").hide();
        $("#noResultsAlert").hide();
        $("#userResultsBody").empty();

        const btn = $(this).find("button[type=submit]");
        btn.prop("disabled", true).html('<i class="fas fa-spinner fa-spin"></i> Searching...');

        fetch(`/api/admin/users?q=${encodeURIComponent(q)}`)
            .then(res => res.json())
            .then(data => {
                btn.prop("disabled", false).html('<i class="fas fa-search"></i> Search');
                if (data.err) return alert(data.err);

                if (data.users && data.users.length > 0) {
                    currentSearchUsers = {};
                    data.users.forEach(u => {
                        currentSearchUsers[u._id] = u;
                        const date = new Date(u.dateJoined).toLocaleDateString();
                        const safeUsername = (u.username || "Unknown").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
                        const tr = $(`
                            <tr>
                                <td><code>${u._id}</code></td>
                                <td><strong>${safeUsername}</strong></td>
                                <td>${date}</td>
                                <td><button class="btn btn-sm btn-primary edit-user-btn" data-id="${u._id}">Edit</button></td>
                            </tr>
                        `);
                        $("#userResultsBody").append(tr);
                    });
                    $("#userResultsTable").show();
                } else {
                    $("#noResultsAlert").show();
                }
            })
            .catch(err => {
                btn.prop("disabled", false).html('<i class="fas fa-search"></i> Search');
                alert("An error occurred while searching.");
                console.error(err);
            });
    });

    $(document).on("click", ".edit-user-btn", function() {
        const id = $(this).data("id");
        const user = currentSearchUsers[id];
        if (!user) return;

        currentEditingUser = user;
        openEditModal(user);
    });

    function openEditModal(user) {
        $("#editUserId").val(user._id);
        $("#editUsername").val(user.username || "");
        $("#editDiscord").val(user.social ? user.social.discord : "");
        $("#editReddit").val(user.social ? user.social.reddit : "");
        $("#editBio").val(user.bio || "");
        $("#editIsAdmin").prop("checked", !!user.isAdmin);
        $("#editAutoChunkable").prop("checked", !!user.autoChunkable);

        renderCerts();
        $("#editUserModal").modal("show");
    }

    function renderCerts() {
        const user = currentEditingUser;
        const container = $("#existingCerts");
        container.empty();

        if (!user.certifications || user.certifications.length === 0) {
            container.html('<span class="text-muted">No certifications.</span>');
            return;
        }

        user.certifications.forEach(cert => {
            const certData = window.CERTIFICATIONS[cert.certificationType] || { name: cert.name, backgroundColor: '#666', textColor: '#fff' };
            const tag = $(`
                <span class="cert-tag" style="background: ${certData.backgroundColor}; color: ${certData.textColor};">
                    ${certData.name} <i class="fas fa-times remove-cert-btn ml-1" data-certid="${cert.certificationType}" style="cursor:pointer;" title="Remove"></i>
                </span>
            `);
            container.append(tag);
        });
    }

    $("#saveUserBtn").on("click", function() {
        if (!currentEditingUser) return;
        const id = currentEditingUser._id;

        const payload = {
            username: $("#editUsername").val(),
            discord: $("#editDiscord").val(),
            reddit: $("#editReddit").val(),
            bio: $("#editBio").val(),
            isAdmin: $("#editIsAdmin").prop("checked"),
            autoChunkable: $("#editAutoChunkable").prop("checked"),
            certifications: currentEditingUser.certifications ? currentEditingUser.certifications.map(c => ({
                certificationType: c.certificationType,
                name: c.name
            })) : []
        };

        const btn = $(this);
        btn.prop("disabled", true).text("Saving...");

        fetch(`/api/admin/users/${id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": Cookies.get(window.CSRF_COOKIE_NAME || "fm_csrf")
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            btn.prop("disabled", false).text("Save Profile Changes");
            if (data.err) return alert(data.err);
            if (data.success) {
                alert("Profile saved successfully.");
                Object.assign(currentEditingUser, data.updatedUser);
            }
        })
        .catch(err => {
            btn.prop("disabled", false).text("Save Profile Changes");
            alert("Error saving profile.");
        });
    });

    $("#addCertBtn").on("click", function() {
        if (!currentEditingUser) return;
        const certId = parseInt($("#addCertSelect").val());
        if (isNaN(certId)) return alert("Please select a certification.");
        
        const customName = $("#addCertName").val().trim();

        if (!currentEditingUser.certifications) currentEditingUser.certifications = [];
        if (!currentEditingUser.certifications.some(c => c.certificationType === certId)) {
            const certData = window.CERTIFICATIONS[certId];
            if (certData) {
                currentEditingUser.certifications.push({
                    certificationType: certId,
                    name: customName || certData.name
                });
                $("#addCertName").val("");
                renderCerts();
            }
        }
    });

    $(document).on("click", ".remove-cert-btn", function() {
        if (!currentEditingUser) return;
        const certId = parseInt($(this).data("certid"));
        if (!isNaN(certId)) {
            currentEditingUser.certifications = currentEditingUser.certifications.filter(c => c.certificationType !== certId);
            renderCerts();
        }
    });

});
