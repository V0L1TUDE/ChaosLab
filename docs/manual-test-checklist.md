# ChaosLab manual demonstration checklist

Run `node server.js`, then complete this list before a professor demonstration.

## Login and authorization

- [ ] Open `/ChaosLab/admin/login/` in a private/incognito browser window.
- [ ] Submit incorrect credentials and confirm the login is rejected.
- [ ] Submit the credentials stored in your local `.env` and confirm you reach the dashboard.
- [ ] In a second private/incognito window, visit `/ChaosLab/admin/dashboard/`; confirm it redirects to login.
- [ ] Click **Log out** and confirm the dashboard can no longer be opened.

## Upload validation

- [ ] Try an unsupported `.exe` upload and confirm it is rejected.
- [ ] Upload an allowed PDF, PowerPoint, Word, ZIP, or image file smaller than 25 MB.
- [ ] Confirm the selected file appears before publishing and downloads correctly afterward.

## Version preservation

- [ ] Publish a presentation as `v1` with metadata and a file.
- [ ] Click **New version**, publish `v2` with a new file, and confirm both rows remain.
- [ ] Open/download both `v1` and `v2` from the archive.
- [ ] Try creating another `v2`; confirm the server reports a duplicate-version error.

## Browser security checks

- [ ] Inspect a response in browser developer tools and confirm `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options` are present.
- [ ] Confirm `.env`, passwords, AWS keys, `chaoslab.db`, and `uploads/` are not tracked by Git.
