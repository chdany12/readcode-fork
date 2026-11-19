import { StoredPost } from "./postService";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPostCard(post: StoredPost): string {
  const links = post.links
    .map((l) => `<li><a href="${esc(l.href)}" rel="nofollow ugc noopener" target="_blank">${esc(l.label)}</a></li>`)
    .join("");
  return [
    `<article class="post" data-id="${esc(post.id)}">`,
    `<p>${esc(post.body)}</p>`,
    links ? `<ul class="links">${links}</ul>` : "",
    `<time datetime="${esc(post.createdAt)}"></time>`,
    `</article>`,
  ].join("");
}
