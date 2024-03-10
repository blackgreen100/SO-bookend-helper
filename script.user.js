// ==UserScript==
// @name         Stack Overflow Bookending Helper
// @description  Easier posts bulk-delete when applying bookending on AI-generated content, forked from Samuel Liew's DeletedUsersHelper (https://github.com/samliew/SO-mod-userscripts/blob/master/DeletedUsersHelper.user.js)
// @downloadURL  https://raw.githubusercontent.com/blackgreen100/SO-bookend-helper/master/script.user.js
// @updateURL    https://raw.githubusercontent.com/blackgreen100/SO-bookend-helper/master/script.user.js
// @author       blackgreen
// @version      0.0.1
//
// @match        https://*.stackoverflow.com/users/*
// @exclude      https://contests.stackoverflow.com/*
// @exclude      *chat.*
// @exclude      *blog.*
// @exclude      */tour
//
// @require      https://raw.githubusercontent.com/samliew/SO-mod-userscripts/master/lib/se-ajax-common.js
// @require      https://raw.githubusercontent.com/samliew/SO-mod-userscripts/master/lib/common.js
//
// @grant        GM_xmlhttpRequest
// ==/UserScript==

/* globals StackExchange, fkey */
/// <reference types="./globals" />

'use strict';

// 404 on a specific user page that has no content
if (document.body.innerText === 'User not found.') {
    // Redirect to user profile page
    location = `/users/${currentUserId}`;
    return;
}

// Moderator check, after the redirection for 404 page above
// This is a moderator-only userscript
if (!isModerator()) return;


// Reload functions
const reloadWhenDone = () => {
    // Triggers when all ajax requests have completed
    $(document).ajaxStop(function () {
        location.reload();
    });
};


let ajaxRequests = 0;

// Get deleted user's username
function getDeletedUsername(uid) {
    ajaxRequests++;

    return new Promise(function (resolve, reject) {
        if (typeof uid === 'undefined' || uid === null) { reject(); return; }

        $.get(`${location.origin}/users/${uid}`)
            .done(function (data) {
                const page = $(data);
                const pageTitle = $('title', data).text();

                // User not deleted or not found
                if (pageTitle && pageTitle.indexOf('User deleted') === -1) {
                    reject();
                    return;
                }

                // Get username
                const details = page.find('#mainbar-full').find('pre').first().text().split(/\r?\n/);
                const username = details[1].match(/: ([^\(]+)/)[1].trim();
                resolve(username);
            })
            .fail(reject)
            .always(() => ajaxRequests--);
    });
}


// Delete individual post
function deletePost(pid) {
    ajaxRequests++;

    return new Promise(function (resolve, reject) {
        if (typeof pid === 'undefined' || pid === null) { reject(); return; }

        $.post({
            url: `${location.origin}/posts/${pid}/vote/10`,
            data: { 'fkey': fkey }
        })
            .fail(reject)
            .always(() => ajaxRequests--);
    });
}
// Delete posts
function deletePosts(pids) {
    if (typeof pids === 'undefined' || pids.length === 0) return;

    pids.forEach(v => deletePost(v));
}


// Undelete individual post
function undeletePost(pid) {
    ajaxRequests++;

    return new Promise(function (resolve, reject) {
        if (typeof pid === 'undefined' || pid === null) { reject(); return; }

        $.post({
            url: `${location.origin}/posts/${pid}/vote/11`,
            data: { 'fkey': fkey }
        })
            .fail(reject)
            .always(() => ajaxRequests--);
    });
}
// Undelete posts
function undeletePosts(pids) {
    if (typeof pids === 'undefined' || pids.length === 0) return;
    pids.forEach(v => undeletePost(v));
}


function getUserDetails(uid) {
    return new Promise(function (resolve, reject) {
        if (typeof uid === 'undefined' || uid === null) { reject(); return; }

        $.post(`${seApiUrl}/users/${uid}?order=desc&sort=reputation&site=${location.hostname.replace(/(\.stackexchange)?\.com$/, '')}&filter=!--1nZv)deGu1&key=lSrVEbQTXrJ4eb4c3NEMXQ((`)
            .done(function (data) {
                resolve(data);
            })
            .fail(reject);
    });
}

function initMultiPostsTable() {
    const table = $('#js-post-summaries');
    if (table.length === 0) return;

    $(this).attr('disabled', true);

    // Add checkboxes
    table.find('.s-post-summary:not(.s-post-summary__deleted)').each(function () {
        const url = $(this).find('a').attr('href');

        if (url && /\/\d+\//.test(url)) {
            const pid = url.match(/\/\d+/g).reverse()[0].substr(1);
            $(this).prepend(`<div><input type="checkbox" class="selected-post" value="${pid}" /></div>`);
            $(this).toggleClass('deleted-answer', $(this).children().last().text() === 'Yes');
        }
    });

    const bookendButton = $('button.so-bookend')

    const btnDiv = $(`<div class="actions"></div>`).insertAfter(bookendButton);

    $(`<input type="button" class="action-btn" value="Select all" />`)
        .appendTo(btnDiv)
        .on('click', function () {
            const boxes = $('.selected-post');
            const active = $(this).attr('active');
            if (!active) {
                boxes.prop('checked', true);
                $(this).attr('active', true);
                $(this).attr('value', 'Deselect all')
            } else {
                boxes.prop('checked', false);
                $(this).attr('active', false);
                $(this).attr('value', 'Select all');
            }

        })

    // Action buttons
    const btnDiv = $(`<div class="actions"></div>`).insertAfter(bookendButton);
    $(`<input type="button" class="action-btn" value="Delete selected" />`)
        .appendTo(btnDiv)
        .on('click', function () {
            let selPostIds = $('.selected-post').filter(':checked').map((i, v) => v.value).get();
            if (selPostIds.length === 0) {
                alert('No posts selected!');
                return false;
            }
            if(!confirm(`Are you sure you want to bulk-delete ${selPostIds.length} selected posts?`)) {
                return;
            }

            $('.action-btn').remove();

            deletePosts(selPostIds)
            reloadWhenDone();
        });
    // $(`<input type="button" class="action-btn" value="Undelete selected" />`)
    //     .appendTo(btnDiv)
    //     .on('click', function () {
    //         let selPostIds = $('.selected-post').filter(':checked').map((i, v) => v.value).get();
    //         if (selPostIds.length === 0) {
    //             alert('No posts selected!');
    //             return false;
    //         }
    //         $('.action-btn').remove();
    //         undeletePosts(selPostIds);
    //         reloadWhenDone();
    //     });

    // Linkify user id in header to return to deleted user page
    $('#content h1').first().html((i, v) => v.replace(/(\d+)/, '<a href="/users/$1" target="_blank">$1</a>'));
}


// Append styles
addStylesheet(`
.orig-username {
  margin-top: 2px;
  color: var(--red-700);
}
.orig-username:before {
  content: '"';
}
.orig-username:after {
  content: '"';
}
.deleted-user,
.comment-user .deleted-user {
  display: inline-block;
  padding: 3px 5px;
  background: var(--red-600) !important;
  color: var(--white) !important;
  font-style: italic;
}
.comment-user .deleted-user + div.orig-username {
  display: inline-block;
  color: var(--red-700);
  margin: 0 4px;
}
table#posts {
  min-width: 80%;
}
table#posts td {
  position: relative;
  background: none !important;
}
.action-btn {
  margin-right: 10px;
}

.del-user-info {
  margin: 15px 0;
  padding: 12px 14px;
  background: var(--black-050);
  font-family: Consolas,Menlo,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New,monospace,sans-serif;
}
.del-user-info input {
  margin: 0;
  padding: 0;
  border: none;
  border-bottom: 1px dashed var(--red-700);
  font-family: Consolas,Menlo,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New,monospace,sans-serif;
  background: transparent;
  color: var(--red-700);
}
.del-user-info .del-reason {
  white-space: pre-wrap;
  margin: 20px 0;
}
#del-user-links {
  margin-top: 10px;
  margin-bottom: 30px;
}
#del-user-links:before {
  content: 'User links';
  display: block;
  margin: 0 0 8px -30px;
  font-weight: bold;
}
#del-user-links li {
  margin-bottom: 4px;
}
#pii-info,
#deleteReasonDetails,
#destroyReasonDetails {
  width: 100%;
  height: calc(8.4em + 20px);
  line-height: 1.2em;
  font-family: Consolas,Menlo,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New,monospace,sans-serif;
}

/* Network Account container */
#del-user-networkaccs {
  margin-top: 10px;
  margin-bottom: 30px;
}
#del-user-networkaccs:before {
  content: 'Network accounts';
  display: block;
  margin: 0 0 8px -30px;
  font-weight: bold;
  clear: both;
}
#del-user-networkaccs:after {
  content: '';
  display: block;
  clear: both;
}
#del-user-networkaccs.js-loading:after {
  content: 'loading...';
}
#del-user-networkaccs.js-no-accounts:after {
  content: '(none)';
  font-style: italic;
  color: var(--black-400);
}
.account-container {
  float: left;
  width: 100%;
  margin-left: -10px;
  padding: 10px;
  text-align: left;
  font-size: 0.9em;
  border-bottom: 1px solid var(--black-050);
  clear: both;
}
.account-container .account-icon {
  width: 48px;
  height: 48px;
  float: left;
  margin-right: 15px;
  text-align: center;
  border-bottom: 1px solid var(--black-075);
  border-left: 1px solid var(--black-025);
  border-right: 1px solid var(--black-025);
  border-top: 1px solid var(--black-025);
}
.account-container .account-icon img {
  width: 48px;
  height: 48px;
  display: block;
  -ms-interpolation-mode: bicubic;
  image-rendering: optimizeQuality;
}
.account-container .account-site {
  float: left;
  width: 424px;
}
.account-container .account-site h2 {
  font-size: 16px;
  line-height: 16px;
  margin-bottom: 4px;
  margin-top: 0 !important;
}
.account-container .account-site p {
  margin-bottom: 2px;
}
.account-container .account-stat {
  width: 80px;
  height: 52px;
  text-align: center;
  color: #A1A1A1;
  font-size: 12px;
  float: left;
  margin-left: 15px;
}
.account-container .account-stat .account-number {
  color: var(--black-600);
  display: inline-block;
  width: 100%;
  font-size: 20px;
  font-family: Arial,Helvetica,sans-serif;
  line-height: 1.6;
  background: var(--black-025);
}
.account-container .account-stat .account-number,
.account-container .account-stat .account-badges {
  height: 32px;
}
.account-container .account-stat .account-badges {
  font-size: 15px;
  line-height: 31px;
  height: 31px !important;
  color: var(--black-600);
}
.account-container .account-stat .account-badges .badgecount {
  font-size: 15px;
}
.account-container .account-stat .account-badges .badge1,
.account-container .account-stat .account-badges .badge2,
.account-container .account-stat .account-badges .badge3 {
  margin-top: -5px;
}
.account-container .account-stat.account-stat-wide {
  width: 138px;
}
.account-container.hidden {
  background: var(--black-075);
}
.account-container.hidden .account-number {
  background: var(--black-075);
}
.account-container.hidden .account-icon {
  border: 1px solid var(--black-075);
}
`); // end stylesheet


// On script run
(function init() {
    if (/\d+/.test(location.pathname) === false) return;

    // Show posts by deleted user page
    else if (location.pathname.match('/users/[0-9]+/') && location.search.includes("tab=answers")) {
        const title = $('h2.fs-title');
        const bookendButton = $(`<button class="so-bookend" style="width: 200px; margin-top: 5px;">Apply Bookending</button>`).insertAfter(title);
        bookendButton.on('click', initMultiPostsTable)
    }
})();
