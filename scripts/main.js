document.addEventListener("DOMContentLoaded", () => {
    const generator = new PreviewGenerator();
    generator.init();
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

        // State parameters.

        this.imageDragged = false;
        this.imageDraggedLast = [0, 0];

        // Dynamic parameters.

        /**
         * @type Image
         */
        this.coverImage = null;
        this.titleText = "";
        this.superText = "";

        this.clearColor = "";
        this.coverImageScale = 1.0;
        this.coverImageOffset = [0, 0];

        // Helpers.

        this.numberFormatter = new Intl.NumberFormat("en", {
            "minimumFractionDigits": 3,
            "useGrouping": false
        });
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
        this._initForm();
        // Connect to mouse events to react to changes.
        this._initEvents();

        // Do the first render.
        this.render();
    }

    _initForm() {
        const backgroundImage_selector = document.getElementById("background-image");
        backgroundImage_selector.addEventListener("change", () => {
            const selectedFiles = backgroundImage_selector.files;
            if (selectedFiles.length === 0) {
                this.coverImage = null;
                this._fitCoverImage();
                this.render();
            } else {
                const imageFile = selectedFiles[0];
                createImageBitmap(imageFile)
                    .then((res) => {
                        this.coverImage = res;
                        this._fitCoverImage();
                        this.render();
                    })
                    .catch((err) => {
                        this.coverImage = null;
                        this._fitCoverImage();
                        this.render();
                    });
            }
        });
        const backgroundImage_fit = document.getElementById("background-image-fit");
        backgroundImage_fit.addEventListener("click", () => {
            this._fitCoverImage();
            this.render();
        });

        const titleText_input = document.getElementById("title-text");
        titleText_input.addEventListener("input", () => {
            this.titleText = titleText_input.value;
            this.render();
        });

        const superText_input = document.getElementById("super-text");
        superText_input.addEventListener("input", () => {
            this.superText = superText_input.value;
            this.render();
        });

        const clearColor_input = document.getElementById("clear-color");
        clearColor_input.addEventListener("input", () => {
            this.clearColor = clearColor_input.value;
            this.render();
        });

        const backgroundImage_scale = document.getElementById("background-image-scale");
        backgroundImage_scale.addEventListener("input", () => {
            this._updateCoverImageScale();
        });
        const backgroundImage_scaleReset = document.getElementById("background-image-scale-reset");
        backgroundImage_scaleReset.addEventListener("click", () => {
            this._setCoverImageScale(1.0);
        });

        const backgroundImage_offsetX = document.getElementById("background-image-offset-x");
        backgroundImage_offsetX.addEventListener("input", () => {
            this._updateCoverImageOffset();
        });
        const backgroundImage_offsetY = document.getElementById("background-image-offset-y");
        backgroundImage_offsetY.addEventListener("input", () => {
            this._updateCoverImageOffset();
        });
        const backgroundImage_offsetReset = document.getElementById("background-image-offset-reset");
        backgroundImage_offsetReset.addEventListener("click", () => {
            this._setCoverImageOffset(0, 0);
        });

        const downloadImage_button = document.getElementById("download-image");
        downloadImage_button.addEventListener("click", () => {
            this._saveRender();
        });
    }

    _initEvents() {
        // Dragging over canvas to reposition the image.

        document.addEventListener("mousedown", (event) => {
            if (event.target !== this.previewCanvas) {
                return;
            }

            this.imageDragged = true;
            this.imageDraggedLast = [ event.clientX, event.clientY ];
            event.preventDefault();
        });
        document.addEventListener("mouseup", () => {
            if (this.imageDragged) {
                this.imageDragged = false;
                this.imageDraggedLast = [0, 0];
            }
        });
        document.addEventListener("mousemove", (event) => {
            if (!this.imageDragged) {
                return;
            }

            const scaleFactor = this._getPreviewPageScale() / this.coverImageScale;
            const nextOffsetX = this.coverImageOffset[0] + (event.clientX - this.imageDraggedLast[0]) * scaleFactor;
            const nextOffsetY = this.coverImageOffset[1] + (event.clientY - this.imageDraggedLast[1]) * scaleFactor;
            this.imageDraggedLast = [ event.clientX, event.clientY ];

            this._setCoverImageOffset(nextOffsetX, nextOffsetY);
        });

        // Scrolling over canvas to scale/zoom the image.

        this.previewCanvas.addEventListener("wheel", (event) => {
            event.preventDefault();

            let scaleFactor = this._getPreviewPageScale() / this.coverImageScale;
            const centerX = (event.clientX - this.previewCanvas.offsetLeft) * scaleFactor - this.coverImageOffset[0];
            const centerY = (event.clientY - this.previewCanvas.offsetTop) * scaleFactor - this.coverImageOffset[1];

            const oldOffsetX = (this.coverImageOffset[0] + centerX) / scaleFactor;
            const oldOffsetY = (this.coverImageOffset[1] + centerY) / scaleFactor;

            this._setCoverImageScale(this.coverImageScale / (1.0 + event.deltaY / 1000));

            scaleFactor = this._getPreviewPageScale() / this.coverImageScale;
            this._setCoverImageOffset(oldOffsetX * scaleFactor - centerX, oldOffsetY * scaleFactor - centerY);
        });
    }

    _setCoverImageScale(value) {
        const backgroundImage_scale = document.getElementById("background-image-scale");
        backgroundImage_scale.value = value;

        this._updateCoverImageScale();
    }

    _updateCoverImageScale() {
        const backgroundImage_scale = document.getElementById("background-image-scale");
        const backgroundImage_scaleText = document.getElementById("background-image-scale-value");

        this.coverImageScale = parseFloat(backgroundImage_scale.value);
        backgroundImage_scaleText.textContent = this.numberFormatter.format(this.coverImageScale);
        this.render();
    }

    _setCoverImageOffset(valueX, valueY) {
        const backgroundImage_offsetX = document.getElementById("background-image-offset-x");
        const backgroundImage_offsetY = document.getElementById("background-image-offset-y");
        backgroundImage_offsetX.value = this.numberFormatter.format(valueX);
        backgroundImage_offsetY.value = this.numberFormatter.format(valueY);

        this._updateCoverImageOffset();
    }

    _updateCoverImageOffset() {
        const backgroundImage_offsetX = document.getElementById("background-image-offset-x");
        const backgroundImage_offsetY = document.getElementById("background-image-offset-y");

        this.coverImageOffset[0] = parseFloat(backgroundImage_offsetX.value);
        this.coverImageOffset[1] = parseFloat(backgroundImage_offsetY.value);
        this.render();
    }

    _fitCoverImage() {
        if (!this.coverImage) {
            this._setCoverImageScale(1.0);
            this._setCoverImageOffset(0, 0);
            return;
        }

        const fittingScale = this.previewWidth / this.coverImage.width;
        this._setCoverImageScale(fittingScale);
        this._setCoverImageOffset(0, (this.previewHeight / fittingScale - this.coverImage.height) / 2);
    }

    _getPreviewPageScale() {
        return this.previewWidth / this.previewCanvas.offsetWidth;
    }

    render() {
        window.requestAnimationFrame(this._renderRoutine.bind(this));
    }

    _renderRoutine() {
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

        // Render the clear color.
        this.ctx.fillStyle = this.clearColor;
        this.ctx.fillRect(0, 0, this.previewWidth, this.previewHeight);

        // Render the cover image.
        if (this.coverImage) {
            this.ctx.scale(this.coverImageScale, this.coverImageScale);
            this.ctx.drawImage(this.coverImage, 0, 0, this.coverImage.width, this.coverImage.height, this.coverImageOffset[0], this.coverImageOffset[1], this.coverImage.width, this.coverImage.height);
            this.ctx.resetTransform();
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
