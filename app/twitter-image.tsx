// Same card for twitter:image — X falls back to og:image inconsistently, so
// emit the tag explicitly. One design, one place to edit: opengraph-image.tsx.
export { default, alt, size, contentType } from "./opengraph-image";
