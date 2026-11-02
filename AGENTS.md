<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Listing creation uses one shared dialog for offers and requests, preserving the homepage layout and keeping field handling consistent.
- Listing inserts use the authenticated browser client with owner-scoped RLS; contact fields are public alongside the listing so visitors can contact its author.
- Listing drafts are kept in session storage through sign-in and restored on the homepage, preventing lost input during authentication.
- External hosts (Render) get public backend config injected in vite.config.ts when RENDER is set, because .env is not committed to git.
