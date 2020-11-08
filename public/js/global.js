let userLocalSettings = JSON.parse(localStorage.getItem("localSettings") || "{}");

if(userLocalSettings.leftAlignedNavbar) $(".navbar").addClass("left-aligned");