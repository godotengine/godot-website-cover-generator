# Godot Blog Cover Generator

A serverless cover generator for the Godot blog. Uses HTML canvas for rendering, so results might slightly differ between browsers.

Currently relies on `letterSpacing` being available for the canvas 2D context, which doesn't work in Firefox or Safari (see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing)).

## License

This project is provided under the [MIT License](LICENSE.md).
