import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { h, FunctionComponent } from "preact";
import { useMemo } from "preact/hooks";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";

const roboto = ['"Roboto"', "sans-serif"].join(", ");
const rubik = ['"Rubik"', "sans-serif"].join(", ");

export const GlacierThemeProvider: FunctionComponent = ({ children }) => {
  const glacier = useMemo(
    () =>
      createTheme({
        palette: {
          mode: chrome.devtools.panels.themeName === "dark" ? "dark" : "light",
          primary: {
            50: "#F0EBF8",
            100: "#D4C7EB",
            200: "#B9A3DE",
            300: "#9D80D2",
            400: "#825CC5",
            500: "#6638B8",
            600: "#542E97",
            700: "#412476",
            800: "#2F1A55",
            900: "#1D1034",
          },
          secondary: {
            50: "#E7F5F6",
            100: "#BCE3E6",
            200: "#90D1D5",
            300: "#65BFC5",
            400: "#39ADB4",
            500: "#0E9BA4",
            600: "#0B7F86",
            700: "#06474B",
            800: "#042B2E",
            900: "#010F10",
            A400: "#0E9BA4",
          },
          error: {
            50: "#FEF3F2",
            100: "#FCEBE9",
            200: "#EFA19C",
            300: "#E97C75",
            400: "#E3584E",
            500: "#DD3327",
            600: "#B52A20",
            700: "#8D2119",
            800: "#661712",
            900: "#3E0E0B",
          },
          warning: {
            50: "#FFF9E6",
            100: "#FFEEBA",
            200: "#FFE28D",
            300: "#FFD760",
            400: "#FFCC34",
            500: "#FFC107",
            600: "#F79009",
            700: "#AE6300",
            800: "#724204",
            900: "#452803",
          },
          success: {
            50: "#EDF7EE",
            100: "#CDE9CE",
            200: "#ADDAAF",
            300: "#8CCC8F",
            400: "#6CBD70",
            500: "#4CAF50",
            600: "#039855",
            700: "#027A48",
            800: "#05603A",
            900: "#054F31",
          },
          info: {
            50: "#E6F6FE",
            100: "#B8E7FC",
            200: "#8BD7FA",
            300: "#5EC8F8",
            400: "#30B8F6",
            500: "#03A9F4",
            600: "#028BC8",
            700: "#026C9C",
            800: "#012F44",
            900: "#001118",
          },
          grey: {
            50: "#FBFBFB",
            100: "#F2F4F7",
            200: "#E4E7EC",
            300: "#D0D5DD",
            400: "#98A2B3",
            500: "#667085",
            600: "#475467",
            700: "#344054",
            800: "#1D2939",
            900: "#101828",
          },
        },
        typography: {
          allVariants: {
            fontFamily: rubik,
            fontWeight: "normal",
          },
          fontFamily: roboto,
          h1: {
            fontSize: "2rem",
            lineHeight: 1.25,
          },
          h2: {
            fontSize: "1.75rem",
            lineHeight: 1.285,
          },
          h3: {
            fontSize: "1.5rem",
            lineHeight: 1.166,
          },
          h4: {
            fontSize: "1.25rem",
            lineHeight: 1.2,
          },
          h5: {
            fontSize: "1.125rem",
            lineHeight: 1.11,
          },
          h6: {},
          body1: {
            fontFamily: roboto,
            lineHeight: 1.5,
          },
          body2: {
            fontFamily: roboto,
            fontSize: "0.875rem",
            lineHeight: 1.428,
          },
          subtitle1: {
            fontSize: "0.875rem",
            lineHeight: 1.142,
            textTransform: "uppercase",
          },
          subtitle2: {},
          button: {
            fontFamily: roboto,
            fontSize: "0.875rem",
            lineHeight: 1.428,
          },
          caption: {},
          overline: {},
        },
      }),
    [chrome.devtools.panels.themeName]
  );

  return (
    <ThemeProvider theme={glacier}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
};
