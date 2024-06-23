const express = require("express");
const route = express.Router();
const moment = require("moment");
const ejs = require("ejs");

const db_con = require("../../utils/database_con");
const common_querys = require("../../utils/common_querys");
const generate_partial = require("../utils/generate_partial");
const disallow_guest = require("../../middleware/disallow_guest")

async function get_user_data(req, res, next) {
    const username = req.params.username || res.locals.user.username

    //Setting all this information, since all pages here will require it, and repeating code is messy.
    res.locals.view_user = await db_con
        .account_db("accounts")
        .where({ username: username })
        .first();

    if (!res.locals.view_user) {
        res.render("pages/errors/users/no_user");
        return;
    }

    res.locals.view_user_stats = await common_querys
        .get_user_stats(res.locals.view_user.id)
        .clone();

    res.locals.view_user_favorites = await common_querys.get_user_favorites
        .clone()
        .where({ "favorites.account_id": res.locals.view_user.id })

    if (!res.locals.guest_mode) {
        res.locals.relationships_with_user = await db_con
            .env_db("relationships")
            .select(
                db_con.env_db
                    .select("status")
                    .from("relationships")
                    .where({
                        from_account_id: res.locals.user.id,
                        to_account_id: res.locals.view_user.id,
                    })
                    .orWhere({
                        from_account_id: res.locals.view_user.id,
                        to_account_id: res.locals.user.id,
                    })
                    .as("friendship_status")
            );
    }

    return next();
}

route.get("/:username", get_user_data, async (req, res) => {
    var user_posts = common_querys.posts_query
        .clone()
        .where({ "posts.account_id": res.locals.view_user.id })
        .orderBy("posts.create_time", "desc")
        .limit(3);
    var user_empathies = common_querys.posts_query
        .clone()
        .where({ "empathies.account_id": res.locals.view_user.id })
        .orderBy("empathies.create_time", "desc")
        .innerJoin("empathies", "empathies.post_id", "=", "posts.id")
        .limit(3);

    if (!res.locals.guest_mode) {
        //Getting if local user has yeahed these posts at all.
        user_posts.select(common_querys.is_yeahed(res.locals.user.id));
        user_empathies.select(common_querys.is_yeahed(res.locals.user.id));
    }

    user_posts = await user_posts;
    user_empathies = await user_empathies;

    res.render("pages/users/user.ejs", {
        view_user_posts: user_posts,
        view_user_empathies: user_empathies,
        view_user: res.locals.view_user,
        view_user_favorites: res.locals.view_user_favorites,
        view_user_stats: res.locals.view_user_stats,
    });
});

route.get("/:username/posts", get_user_data, async (req, res) => {
    const limit = req.query["limit"] || 25;
    const offset = req.query["offset"] || 0;
    const raw = req.query["raw"] || 0;

    var user_posts = common_querys.posts_query
        .clone()
        .where({ "posts.account_id": res.locals.view_user.id })
        .orderBy("posts.create_time", "desc")
        .limit(limit)
        .offset(offset);

    if (!res.locals.guest_mode) {
        user_posts.select(common_querys.is_yeahed(res.locals.user.id));
    }

    user_posts = await user_posts;

    if (raw) {
        if (!user_posts.length) {
            res.sendStatus(204);
            return;
        }

        generate_partial.generate_posts_partial(res, user_posts, true)
        return;
    }

    res.render("pages/users/user_posts.ejs", {
        view_user_posts: user_posts,
        view_user: res.locals.view_user,
        view_user_favorites: res.locals.view_user_favorites,
        view_user_stats: res.locals.view_user_stats,
    });
});

route.get("/:username/empathies", get_user_data, async (req, res) => {
    const limit = req.query["limit"] || 25;
    const offset = req.query["offset"] || 0;
    const raw = req.query["raw"] || 0;

    var user_empathies = common_querys.posts_query
        .clone()
        .where({ "empathies.account_id": res.locals.view_user.id })
        .orderBy("empathies.create_time", "desc")
        .innerJoin("empathies", "empathies.post_id", "=", "posts.id")
        .limit(limit)
        .offset(offset);

    if (!res.locals.guest_mode) {
        user_empathies.select(common_querys.is_yeahed(res.locals.user.id));
    }

    user_empathies = await user_empathies;

    if (raw) {
        if (!user_empathies.length) {
            res.sendStatus(204);
            return;
        }

        generate_partial.generate_posts_partial(res, user_empathies, true)

        return;
    }

    res.render("pages/users/user_empathies.ejs", {
        view_user_empathies: user_empathies,
        view_user: res.locals.view_user,
        view_user_favorites: res.locals.view_user_favorites,
        view_user_stats: res.locals.view_user_stats,
    });
});

route.get("/:username/favorites", get_user_data, async (req, res) => {
    const limit = req.query["limit"] || 15
    const offset = req.query["offset"] || 0
    const raw = req.query["raw"]

    const communities = await db_con.env_db("communities")
        .select("communities.*")
        .where({ "favorites.account_id": res.locals.view_user.id })
        .leftJoin("favorites", "favorites.community_id", "=", "communities.id")
        .orderBy("favorites.create_time", "desc")
        .limit(limit)
        .offset(offset)

    if (raw) {
        if (!communities.length) { res.sendStatus(204); return; }

        generate_partial.generate_community_partial(res, communities, false);
        return;
    }

    res.render("pages/users/user_favorites", {
        communities: communities
    })
})

route.get("/@me/settings", disallow_guest, get_user_data, async (req, res) => {
    res.render("pages/users/user_settings.ejs");
})

module.exports = route;
