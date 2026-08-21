import { themeInitScript } from "./theme";

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
