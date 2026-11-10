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

## Testing the budgeting tool
- The budgeting tool is a static HTML page (`public/budget.html`) shown in an iframe, so its logic cannot be imported; tests load that file in jsdom and assert on the values the page renders (`src/test/weekly-savings.test.ts`). Why: the page's math lives in an inline script no module import can reach.
- The React account shell uses a same-origin iframe bridge and owner-scoped database reads plus an atomic, revision-checked invoker RPC for writes; this preserves the existing budget layout and prevents partial or stale saves.
- Budget mapping is centralized in budget-data; every cloud table is owner- and mode-scoped, with receipts stored separately as private object paths to avoid mixing money or persisting image payloads in spending rows.
