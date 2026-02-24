const express = require('express');
const User = require('../models/User');
const Utils = require('../Utils');
const SETTINGS = require('../Settings');

module.exports = (app, sharedTokens, requireCsrf) => {
	const LoginMiddleware = require('../middleware/LoginMiddleware')(sharedTokens);

	// Render Admin Dashboard Page
	app.get('/admin', LoginMiddleware, async (req, res) => {
		const user = await req.getProfile();
		if (!user || (!user.isAdmin)) {
			return res.status(403).send("Forbidden. Administrators only.");
		}

		res.render('admin', {
			...(await Utils.templateEngineData(req)),
			certifications: SETTINGS.SITE.CERTIFICATIONS
		});
	});

	// API: Search Users
	app.get('/api/admin/users', LoginMiddleware, async (req, res) => {
		const user = await req.getProfile();
		if (!user || !user.isAdmin) return res.json({ err: "Forbidden" });

		const query = (req.query.q || "").trim();
		if (query.length < 2) return res.json({ err: "Query too short", users: [] });

		// Search linearly by username or exact TagPro URL or specific _id
		const safeQuery = Utils.cleanQuery(query);
		const regex = new RegExp(`^${safeQuery}`, 'i');
		
		let searchCriteria = {
			$or: [
				{ username: regex },
				{ tagproProfile: query }
			]
		};

		if (query.length === 24 && query.match(/^[0-9a-fA-F]{24}$/)) {
			searchCriteria.$or.push({ _id: query });
		}

		const users = await User.find(searchCriteria).limit(50).lean();
		res.json({ success: true, users });
	});

	// API: Update Profile Settings
	app.post('/api/admin/users/:id', LoginMiddleware, requireCsrf, async (req, res) => {
		const adminUser = await req.getProfile();
		if (!adminUser || !adminUser.isAdmin) return res.json({ err: "Forbidden" });

		const targetUser = await User.findById(req.params.id);
		if (!targetUser) return res.json({ err: "User not found" });

		if(Utils.hasCorrectParameters(req.body, {
			username: "string",
			discord: "string",
			reddit: "string",
			bio: "string",
			isAdmin: "boolean",
			autoChunkable: "boolean",
			certifications: "object"
		})) {
            targetUser.username = req.body.username.trim().slice(0, 32);
			targetUser.social.discord = req.body.discord.trim().slice(0, 37);
			targetUser.social.reddit = req.body.reddit.replace('/u/', '').trim().slice(0, 30);
			targetUser.bio = req.body.bio.trim().slice(0, 500);
			targetUser.isAdmin = req.body.isAdmin;
			targetUser.autoChunkable = req.body.autoChunkable;

			if (Array.isArray(req.body.certifications)) {
				targetUser.certifications = [];
				const seenCerts = new Set();
				
				req.body.certifications.forEach(certObj => {
                    if (!certObj || typeof certObj !== 'object') return;
                    
					const numId = Number(certObj.certificationType);
					if (SETTINGS.SITE.CERTIFICATIONS[numId] && !seenCerts.has(numId)) {
						seenCerts.add(numId);
                        
                        let customName = typeof certObj.name === 'string' ? certObj.name.trim().slice(0, 50) : "";
                        if (customName.length === 0) customName = SETTINGS.SITE.CERTIFICATIONS[numId].name;
                        
						targetUser.certifications.push({
							certificationType: numId,
							name: customName
						});
					}
				});
			}

			await targetUser.save();
			res.json({ success: true, updatedUser: targetUser });
		} else {
			res.json({ err: "Invalid parameter format" });
		}
	});

};
