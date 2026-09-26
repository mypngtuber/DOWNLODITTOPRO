# ImageDropper 0.1.0

A dockable Adobe Premiere Pro UXP panel for **image URL → permanent local file → Premiere Project Bin**. No timeline changes, cloud service, API key, or build step.

## Requirements and compatibility

- Windows: Adobe Premiere Pro **25.6 or newer**, UXP Developer Tool **2.2 or newer**. Manifest v5.
- Adobe's published UXP `Project.getActiveProject`, `Project.importFiles`, `Project.getRootItem`, `FolderItem.createBinAction`, `FolderItem.getItems`, `ClipProjectItem.getMediaFilePath` and `executeTransaction` references each say **Since 25.6**. Although an earlier target of 25.3 was requested, claiming support for 25.3 would be misleading. The manifest deliberately prevents installation in 25.3–25.5.
- An open Premiere project, internet connection, and permission to write to the chosen Documents folder.
- Direct JPG/JPEG, PNG and WEBP image URLs (up to 100 MB). The response bytes are checked against the actual image format and MIME when present. Whether Premiere can decode a particular WEBP still depends on the installed Premiere version/codecs; failure retains the original download.

## Files

```
ImageDropper/
├── manifest.json         UXP v5, Premiere host and permissions
├── index.html            dockable panel
├── index.js              workflow and status
├── styles.css            dark panel styling
├── downloader.js         HTTP validation, timeout, size and image signature
├── storage.js            durable folder selection and collision-free saves
├── metadata.js           URL-to-file lookup (plugin data)
├── premiere.js           project and bin operations
├── importer.js           direct bin import and media-path verification
├── utils.js              image and filename helpers
├── tests.js              Node-based tests with mocked UXP/Premiere
└── README.md
```

## Install on Windows with UXP Developer Tool

1. Install Premiere Pro **25.6+** from Creative Cloud and install **UXP Developer Tool 2.2+** from Creative Cloud. Sign in to Creative Cloud.
2. Download/clone this repository to a **permanent location** such as `C:\Users\<you>\Documents\ImageDropperPlugin`. Keep all files together, with `manifest.json` at the folder root. Do not select an individual JS file.
3. Launch Premiere Pro, open or create a project, and leave Premiere running.
4. Open UXP Developer Tool, click **Add Plugin** (the `+` button), and select `C:\Users\<you>\Documents\ImageDropperPlugin\manifest.json`.
5. Select **ImageDropper** in the Developer Tool and click **Load**. In Premiere, use **Window → UXP Plugins → ImageDropper** (on some host builds the menu is **Plugins → ImageDropper**) to show and dock the panel. If needed, use **Reload** in Developer Tool after editing files.
6. Accept the requested network and file access prompts. The network permission is `domains: all` because image links may point to any host or redirect; file permission is `request`, not unrestricted filesystem access.

## Use and test in Premiere

1. Open a Premiere project **before** importing. Paste a direct image link into **Image URL** and click **Import Image**.
2. **First use only:** UXP opens a folder picker at your Documents location. Select your actual **Documents folder** (for example `C:\Users\<you>\Documents`, or your redirected OneDrive Documents folder). ImageDropper automatically creates `ImageDropper\Images` within it. UXP does not document a silent, reliable API to locate the user's redirected Documents path; selection is necessary once, and a persistent permission token is stored for later sessions. Canceling makes no download.
3. Wait for the download/save/import status. The exact file path is shown after success. Find `ImageDropper` at the root of the Premiere Project panel and verify the image is inside. **Save the Premiere project** (Ctrl+S) so the Project panel items persist after reopening. The downloaded file itself remains even when Premiere is closed.
4. Open **Settings → Choose another folder** to use a different *existing* permanent Images folder. This selection is used directly, not nested inside a new `ImageDropper/Images`. The choice and duplicate preference survive restart.
5. Repeat the same URL: the saved file is reused if it still exists in the selected folder, and the already-imported bin item is reused. Try another URL with the same filename to see `name_001.jpg`. Test invalid URLs, HTTP 404, HTML responses, offline mode, and a project-free session for readable errors.

The default downloaded media lives in `Documents\ImageDropper\Images\`. **Never move/delete these source files** if you want Premiere's project links to remain online. ImageDropper never uses a temporary cache as the media source and never deletes saved downloads. Its JSON URL lookup lives in UXP's persistent plugin data area; losing that lookup on uninstall does not remove the images. If import fails after download, the panel displays the saved path; keep the project open and click Import Image again to retry.

## Troubleshooting / known limitations

- **25.3–25.5:** Adobe's documented bin/import API first appears at 25.6. Upgrade Premiere; this plugin intentionally does not use undocumented calls.
- **No project:** Open a Premiere project first. Save the project after importing.
- **Folder picker / permission failure:** Select Documents on first use, or select an existing writable folder via Settings. If a folder was moved or its UXP token was revoked, the picker will appear again. Select your original Documents folder to avoid changing storage location.
- **HTTP / CORS / login / redirects:** Paste a publicly accessible *direct image* URL, not a webpage. Servers requiring login, blocking UXP requests, or redirecting to disallowed HTTP destinations can fail. HTTPS is recommended; macOS can block HTTP at the platform level. A network timeout is 45 seconds; maximum image size is 100 MB.
- **Format checks:** JPG/JPEG, PNG and WEBP signatures and MIME are checked; full file decoding remains Premiere's responsibility. Some servers omit Content-Type; the signature then decides. JPEG files with `.jpeg` names keep that suffix.
- **Duplicate protection:** URL-based reuse only, not SHA-256 deduplication across different URLs. The latter was left out because UXP has no verified native hashing API for this target; independent URLs with identical bytes may get separate files. Switching storage folders does not silently reuse files in the previous folder.
- **Import failure:** The local image stays in the storage folder. If Premiere cannot decode it, inspect the saved file, try another image, or import the saved image manually. There is no automatic deletion or timeline operation.
- **Testing:** `node tests.js` runs mocked unit/integration tests on a computer with Node.js. These do **not** replace running the full click-through test in a real Windows Premiere 25.6+ installation; this repository was developed without a Premiere runtime.

## Verified API references

- [Premiere Project API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project/) — `getActiveProject`, `getRootItem`, `executeTransaction`, `importFiles(filePaths, suppressUI, targetBin, asNumberedStills)`.
- [Premiere FolderItem API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/folderitem/) — `getItems`, `createBinAction`.
- [Premiere ClipProjectItem API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/clipprojectitem/) — `getMediaFilePath`.
- [UXP filesystem recipe](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/filesystem-operations/) — userDocuments folder picker, persistent tokens, binary file writes.
- [UXP network recipe](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/network/) and [manifest reference](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/).
