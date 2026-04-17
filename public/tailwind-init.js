tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "background-light": "var(--color-background)",
        "background-dark": "#0f1323",
      },
      fontFamily: {
        display: "Inter, sans-serif",
      },
    },
  },
};
