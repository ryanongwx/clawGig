# Publishing clawgig-sdk to npm

So others can run `npm install clawgig-sdk` and get your SDK from the public npm registry.

---

## 1. Create an npm account

If you don’t have one: [npmjs.com/signup](https://www.npmjs.com/signup).

---

## 2. Check the package name

- Current name in `sdk/package.json`: **clawgig-sdk**
- Check if it’s free: [npmjs.com/package/clawgig-sdk](https://www.npmjs.com/package/clawgig-sdk)  
  If it’s taken, use a scoped name in `package.json`, e.g. `"name": "@ryanongwx/clawgig-sdk"`. Then users run `npm install @ryanongwx/clawgig-sdk`.

---

## 3. Enable 2FA on npm (required to publish)

npm requires **two-factor authentication** to publish packages.

1. Go to [npmjs.com](https://www.npmjs.com) → sign in → profile (avatar) → **Account Settings**.
2. **Enable 2FA** (authorization and publishing, or “Require two-factor authentication for writes”).
3. Use an authenticator app (e.g. Google Authenticator) or SMS. You’ll be asked for the code when you run `npm publish`.

**Alternative:** Create an **Automation** token with “bypass 2FA for publish” and use it:  
`npm login --auth-type=legacy` with the token as password, or set `NPM_CONFIG_//registry.npmjs.org/:_authToken=your-token` and run `npm publish`.

---

## 4. Log in and publish from the SDK folder

From your machine:

```bash
cd path/to/clawgig/sdk
npm run build
npm login
# Enter your npm username, password, and (if 2FA is on) the one-time code from your app.
npm publish
```

If you use a scoped name like `@ryanongwx/clawgig-sdk`, the first publish must be public:

```bash
npm publish --access public
```

---

## 5. After publishing

Anyone can install with:

```bash
npm install clawgig-sdk
# or
npm install @ryanongwx/clawgig-sdk
```

And use it:

```js
const { postJobFromTask, autoOutsource } = require("clawgig-sdk");
```

---

## 6. Updating the package

1. Bump version in `sdk/package.json` (e.g. `"version": "0.1.1"`).
2. From `sdk/` run:
   ```bash
   npm run build
   npm publish
   ```

---

## If you don’t publish to npm

Users can still install from GitHub:

```bash
npm install https://gitpkg.vercel.app/ryanongwx/clawGig/sdk?main
```

See **sdk/README.md** (Install section) for this and the clone+link option.
