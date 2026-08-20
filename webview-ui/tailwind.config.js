/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: 'var(--vscode-sideBar-background)',
          fg: 'var(--vscode-sideBar-foreground)',
          border: 'var(--vscode-sideBar-border, rgba(255, 255, 255, 0.1))',
          inputBg: 'var(--vscode-input-background)',
          inputFg: 'var(--vscode-input-foreground)',
          inputBorder: 'var(--vscode-input-border, rgba(255, 255, 255, 0.15))',
          buttonBg: 'var(--vscode-button-background)',
          buttonFg: 'var(--vscode-button-foreground)',
          buttonHover: 'var(--vscode-button-hoverBackground)',
          badgeBg: 'var(--vscode-badge-background)',
          badgeFg: 'var(--vscode-badge-foreground)',
          codeBg: 'var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.25))',
          highlight: 'var(--vscode-editor-selectionBackground)',
          editorBg: 'var(--vscode-editor-background)',
          editorFg: 'var(--vscode-editor-foreground)',
          widgetBg: 'var(--vscode-editorWidget-background)',
          widgetBorder: 'var(--vscode-widget-border)',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
