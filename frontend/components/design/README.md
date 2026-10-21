# TB Guard 3D Design

Native Next.js integration of the supplied `3dDesign/src` editor. Open `/design`
through the application sidebar. It uses the existing authentication and layout.
Run the frontend normally with `npm run dev`; no Vite server is required.

- `App.tsx`: component inspector, assembly settings, save/import/export, animation controls.
- `DeviceViewer.tsx`: Three.js scene, CAD meshes, camera and display modes.
- `engineering.ts`, `wiring.ts`: assembly geometry, project validation and connections.
- `animation.ts`, `exports.ts`: presentation animation, video and design exports.
- `design.css`: scoped styles using the host's theme tokens, Poppins and container queries.
- `public/models/design`: the three GLB models used at runtime, copied from the source project.

The route loads the editor on the client because WebGL requires a browser.
Saved projects use browser storage (`tbguard-design-project-v1`); JSON export/import
provides portable project files. Prototype settings are independent of monitored
device records. The original CAD sources remain in `3dDesign/public/models`.

Maintain the integrated code here. The standalone source folder is not a runtime
dependency. Model geometry and engineering validation retain the source's
provisional design assumptions.
