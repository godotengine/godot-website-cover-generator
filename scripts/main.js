document.addEventListener("DOMContentLoaded", () => {
    const generator = new PreviewGenerator();
    generator.init();

    generator.testVercel();
});

class PreviewGenerator {
    constructor() {
        /**
         * @type HTMLCanvasElement
         */
        this.previewCanvas = null;
        /**
         * @type HTMLCanvasElement
         */
        this.targetCanvas = null;
        /**
         * @type CanvasRenderingContext2D
         */
        this.ctx = null;

        this.targetWidth = 1280;
        this.targetHeight = 720;

        this.previewScale = 2.0;
        this.previewWidth = this.targetWidth * this.previewScale;
        this.previewHeight = this.targetHeight * this.previewScale;

        /**
         * @type Image
         */
        this.godotLogo = null;

        // Dynamic parameters.

        /**
         * @type Image
         */
        this.coverImage = null;
        this.titleText = "";
        this.superText = "";

        // TODO: Remove when matched and tested.
        this.vercelOutput = null;
        this.showVercel = false;
    }

    init() {
        this.targetCanvas = document.getElementById("render-target");
        this.targetCanvas.width = this.targetWidth;
        this.targetCanvas.height = this.targetHeight;

        this.previewCanvas = document.getElementById("generator");
        this.previewCanvas.width = this.previewWidth;
        this.previewCanvas.height = this.previewHeight;

        this.ctx = this.previewCanvas.getContext("2d");

        // Fonts may take a moment to load, make sure to update preview when
        // they are done loading.
        document.fonts.onloadingdone = () => {
            this.render();
        }

        // Load the Godot logo.
        this._loadImage("assets/godot-logo.svg", (image) => {
            this.godotLogo = image;
            this.render();
        });

        // Connect to the toolbar panel to react on changes.

        const backgroundImage_selector = document.getElementById("background-image");
        backgroundImage_selector.addEventListener("change", () => {
            const selectedFiles = backgroundImage_selector.files;
            if (selectedFiles.length === 0) {
                this.coverImage = null;
                this.render();
            } else {
                const imageFile = selectedFiles[0];
                createImageBitmap(imageFile)
                    .then((res) => {
                        this.coverImage = res;
                        this.render();
                    })
                    .catch((err) => {
                        this.coverImage = null;
                        this.render();
                    });
            }
        });

        const titleText_input = document.getElementById("title-text");
        titleText_input.addEventListener("change", () => {
            this.titleText = titleText_input.value;
            this.render();
        });

        const superText_input = document.getElementById("super-text");
        superText_input.addEventListener("change", () => {
            this.superText = superText_input.value;
            this.render();
        });

        const downloadImage_button = document.getElementById("download-image");
        downloadImage_button.addEventListener("click", () => {
            this._saveRender();
        });

        // TODO: REMOVE
        const showVercel_toggle = document.getElementById("show-vercel");
        showVercel_toggle.addEventListener("change", () => {
            this.showVercel = showVercel_toggle.checked;
            this.render();
        });

        // Do the first render.
        this.render();
    }

    testVercel() {
        this._loadImage("assets/output-vercel.png", (image) => {
            this.vercelOutput = image;
            this.render();
        });
    }

    render() {
        if (!this.previewCanvas || !this.ctx) {
            return;
        }

        // Clear the canvas.
        this.ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        // Reset rendering styles.
        this.ctx.fillStyle = "black";
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0)";
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        this.ctx.font = "10px sans-serif";
        this.ctx.letterSpacing = "0px";

        // Render the cover image.
        if (this.coverImage) {
            this.ctx.drawImage(this.coverImage, 0, 0, this.previewWidth, this.previewHeight);
        }

        // Render the overlay as a gradient from top-right to bottom-left.
        const overlayGradient = this.ctx.createLinearGradient(this.previewWidth, 0, 0, this.previewHeight);
        overlayGradient.addColorStop(0, "rgba(32, 79, 159, 0.1)");
        overlayGradient.addColorStop(0.85, "rgba(14, 13, 30, 0.4)");

        this.ctx.fillStyle = overlayGradient;
        this.ctx.fillRect(0, 0, this.previewWidth, this.previewHeight);

        // Render decorations.

        const relativeUnit = (this.previewWidth - 6) / 100.0;
        const paddingSize = 4 * relativeUnit;

        // Render the title.
        const titleSize = 8 * relativeUnit;
        const titleOffset = 2 * relativeUnit + paddingSize + 0.2 * titleSize;

        this.ctx.font = `bold ${titleSize}px 'JetBrains Mono', monospace`;
        this.ctx.letterSpacing = "0px";
        this.ctx.fillStyle = "white";
        this.ctx.fillText(this.titleText, paddingSize, this.previewHeight - titleOffset);

        // Render the super text.
        const supertextSize = 3.5 * relativeUnit;
        const supertextOffset = 3 * relativeUnit + titleSize + titleOffset + 0.06 * supertextSize;

        this.ctx.font = `bold ${supertextSize}px 'JetBrains Mono', monospace`;
        this.ctx.letterSpacing = `${1.4 * relativeUnit}px`;
        this.ctx.fillStyle = "white";
        this.ctx.fillText(this.superText.toUpperCase(), paddingSize, this.previewHeight - supertextOffset);

        // Render break line.
        const breaklineWidth = 8 * relativeUnit;
        const breaklineHeight = 0.6 * relativeUnit;
        const breaklineOffset = 3 * relativeUnit + supertextSize + supertextOffset + 0.2 * breaklineHeight;

        this.ctx.fillStyle = "white";
        this.ctx.fillRect(paddingSize, this.previewHeight - breaklineOffset - breaklineHeight, breaklineWidth, breaklineHeight);

        // Render the Godot logo.
        if (this.godotLogo) {
            const logoWidth = 0.36 * this.previewWidth;
            const logoHeight = this.godotLogo.height * (logoWidth / this.godotLogo.width);

            this.ctx.shadowBlur = 140;
            this.ctx.shadowColor = "rgb(0 0 0 / 0.4)";
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;

            this.ctx.drawImage(this.godotLogo, this.previewWidth - paddingSize - logoWidth, paddingSize, logoWidth, logoHeight);
        }

        // TODO: REMOVE
        if (this.showVercel && this.vercelOutput) {
            this.ctx.drawImage(this.vercelOutput, 0, 0, this.previewWidth, this.previewHeight);
        }
    }

    /**
     *
     * @param {String} imagePath
     * @param {CallableFunction} callback
     */
    _loadImage(imagePath, callback) {
        const image = new Image();
        image.onload = () => {
            callback(image);
        };

        image.src = imagePath;
    }

    _saveRender() {
        if (!this.previewCanvas || !this.targetCanvas) {
            return;
        }

        const targetContext = this.targetCanvas.getContext("2d");
        targetContext.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
        targetContext.drawImage(this.previewCanvas, 0, 0, this.targetWidth, this.targetHeight);

        const imageData = this.targetCanvas.toDataURL("image/webp", 0.95);
        const fakeAnchor = document.createElement("A");
        fakeAnchor.setAttribute("download", "image.webp");
        fakeAnchor.setAttribute("href", imageData);
        fakeAnchor.click();
    }
}
