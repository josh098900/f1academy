// Display-name validation bounds. Lives in its own module because the values
// are imported by both the "use server" action (server-only, only async
// functions can be exported) and the client editor component.
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;
