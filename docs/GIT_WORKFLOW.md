# Publish from the correct Git worktree

A checkout may contain nested repositories or multiple worktrees. A directory name alone does not identify the repository to publish. The coordinator will give you the exact worktree path; open that directory before proceeding. An older, independent bootstrap may exist outside that worktree: leave it intact. Do not delete it or upload its contents over the intended repository.

## Confirm and preserve your work

Run these checks in the coordinator-provided directory:

```sh
git rev-parse --show-toplevel
git rev-parse --git-common-dir
git worktree list
git status --short --branch
git remote -v
```

Confirm the root, shared repository, branch and remote before staging anything. A worktree's `.git` can be a file; never copy or publish it. Stop if the repository is not the intended one.

Create a new feature branch from current `main` without losing local changes. First inspect status and preserve uncommitted work with `git stash push --include-untracked` if needed (ignored files are not included; back up any needed ignored files separately). Then:

```sh
git fetch origin
git switch -c docs/publish-update origin/main
```

Use an unused, task-specific branch name. After fetching, `origin/main` is the current remote main; the new branch starts there without moving a local `main` or disturbing a worktree that already has it checked out. If you created a stash, identify it with `git stash list` and apply that specific entry with `git stash apply`. Resolve any conflicts without discarding local work; keep the stash until you have verified the restored changes. Do not use hard reset, force checkout or clean as a shortcut.

## Review, stage and publish

Keep canonical contracts, small source images with attribution, `LICENSE`, the current README/docs, source, scripts and CI configuration. Do not commit `.git`, `.audit`, `.validation`, `.env`/secrets, `node_modules`, `dist`, `bin`, `obj`, `data/raw`, large DEMs, generated GLBs or generated relief PNGs. Regenerate local assets using the documented setup instead. Check ignore rules and staged files; ignores do not automatically untrack files already in Git.

Remove obsolete prompt files only from the working tree, after confirming they are obsolete and in scope. Let Git record those deletions normally; do not rewrite history, erase prior contributions or fabricate author identities.

From the verified worktree root, after reviewing the intended changes:

```sh
git add -A
git status --short
git --no-pager diff --cached --stat
git --no-pager diff --cached
git --no-pager diff --cached --check
```

`git add -A` records additions, modifications **and deletions**. Review everything it stages, including unrelated local work and prohibited artifacts; unstage unintended paths before committing. Do not manually upload folders: that can omit deletions, include generated data and target the wrong repository.

Run the relevant checks in [Development](DEVELOPMENT.md), then commit under your own configured identity and push the feature branch to the verified remote. Open a pull request against `main`; retain existing history and authorship. Use current test/CI results rather than fixed test-count claims. No Git command in this guide is evidence that it has already been executed.
