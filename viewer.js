(function (window) {
  "use strict";

  var self;

  function ImageViewer(canvasId, imageUrl){
    self = this;

    // canvas
    this.canvas = document.getElementById(canvasId);
    this.context = this.canvas.getContext("2d");

    // image scale
    this.scale = 1;
    this.scale_old = null;
    this.scaleStep = 0.1;

    // image center (scroll offset)
    this.center =
    this.center_old = {
      x: 0,
      y: 0
    };

    // image
    this.image = new Image();
    this.image.addEventListener('load', this._onImageLoad, false);
    this.image.src = imageUrl;
    this.image_old = null;
    this.visiblePart = null;
    this.canvasImage = null;

    // target point
    this.targetEnabled = true;
    this.target =
    this.target_old = {
      x: 0,
      y: 0
    };

    // render loop
    this.FPS = 1000/30;
    this.tickInterval = null;

    this.InputHandler = new InputHandler(this.canvas, this);
  }
  
  ImageViewer.prototype._onImageLoad = function(){
    // set scale to use as much space inside the canvas as possible
    if(((self.canvas.height / self.image.height) * self.image.width) <= self.canvas.width){
      self.scale = self.canvas.height / self.image.height;
    } else {
      self.scale = self.canvas.width / self.image.width;
    }

    // center at image center
    self.center.x = self.image.width / 2;
    self.center.y = self.image.height / 2;

    // start render loop
    self.tickInterval = setInterval(function(){self._render()}, self.FPS);
  };

  ImageViewer.prototype._isDirty = function(newScale){
    // TODO: rethink this
    return !((this.image === this.image_old)
        && (this.scale === this.scale_old)
        && (this.center.x === this.center_old.x && this.center.y === this.center_old.y)
        && (this.target == null || (this.target_old == null && this.target.x === this.target_old.x && this.target.y === this.target_old.y)));
  };

  ImageViewer.prototype._render = function(){
    // check if dirty
    if(!this._isDirty()) return;

    // reset flags
    this.image_old = this.image;
    this.center_old = {
      x: this.center.x,
      y: this.center.y
    };
    this.target_old = (this.target !== null) ? {
      x: this.target.x,
      y: this.target.y
    } : null;
    this.scale_old = this.scale;

    // clear canvas
    this.context.clearRect ( 0 , 0 , this.canvas.width, this.canvas.height );

    // calculate image properties
    var widthToRight = this.image.width - this.center.x
      , widthToLeft = this.center.x
      , heightToTop = this.center.y
      , heightToBottom = this.image.height - this.center.y
      , maxPartWidth = this.canvas.width / this.scale
      , maxPartHeight = this.canvas.height / this.scale
      , actualPartWidthRight = widthToRight >= (maxPartWidth / 2) ? maxPartWidth / 2 : widthToRight
      , actualPartWidthLeft = widthToLeft >= (maxPartWidth / 2) ? maxPartWidth / 2 : widthToLeft
      , actualPartHeightTop = heightToTop >= (maxPartHeight / 2) ? maxPartHeight / 2 : heightToTop
      , actualPartHeightBottom = heightToBottom >= (maxPartHeight / 2) ? maxPartHeight / 2 : heightToBottom;
    this.visiblePart = {
      x: this.center.x - actualPartWidthLeft,
      y: this.center.y - actualPartHeightTop,
      width: actualPartWidthRight + actualPartWidthLeft,
      height: actualPartHeightTop + actualPartHeightBottom
    };
    this.canvasImage = {
      x: ((maxPartWidth / 2) - actualPartWidthLeft) * this.scale,
      y: ((maxPartHeight / 2) - actualPartHeightTop) * this.scale,
      width: this.visiblePart.width * this.scale,
      height: this.visiblePart.height * this.scale
    };

    // draw image
    this.context.drawImage(
      this.image,
      this.visiblePart.x, this.visiblePart.y, this.visiblePart.width, this.visiblePart.height, // part of image
      this.canvasImage.x, this.canvasImage.y, this.canvasImage.width, this.canvasImage.height  // position and size within canvas
    );

    if(this.targetEnabled && this.target !== null){
      this._drawTarget();
    }
  };

  ImageViewer.prototype._drawTarget = function(){
    var centerCorrection = { // based on shape below
      x: 0,
      y: -30
    };

    this.context.save();

    var shapeScale = 1.5
      , xTranslation = (
                          this.target.x  // x-pos of target on picture
                        + centerCorrection.x * shapeScale // scaled x-offset of center of target shape
                        + this.canvas.width / this.scale / 2 // offset of scaled canvas
                        - this.center.x // scroll offset of image
                       ) * this.scale // scale the transformation

      , yTranslation = (
                          this.target.y  // y-pos of target on picture
                        + centerCorrection.y * shapeScale // scaled y-offset of center of target shape
                        + this.canvas.height / this.scale / 2 // offset of scaled canvas
                        - this.center.y // scroll offset of image
                       ) * this.scale // scale the transformation
      ;
    this.context.translate(xTranslation, yTranslation);

    this.context.scale(shapeScale * this.scale, shapeScale * this.scale);
    this.context.lineWidth = 2;
    this.context.strokeStyle = '#ff0000';
    this.context.fillStyle = '#ff0000';

    // flag
    this.context.beginPath();
    this.context.moveTo(0, 10);
    this.context.lineTo(15, 15);
    this.context.lineTo(15, 5);
    this.context.lineTo(0, 0);
    this.context.lineTo(0, 30);
    this.context.stroke();

    // bulls-eye
    // inner circle
    this.context.beginPath();
    this.context.arc(0, 30, 5, 0, 2 * Math.PI, false);
    this.context.stroke();
    // outer circle
    this.context.beginPath();
    this.context.arc(0, 30, 10, 0, 2 * Math.PI, false);
    this.context.stroke();

    this.context.restore();
  };

  function InputHandler(canvas, imageViewer) {
    this.canvas = canvas;
    this.imageViewer = imageViewer;

    // global
    this.leftMouseButtonDown = false
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);

    // zooming
    this.canvas.addEventListener('DOMMouseScroll', this._onMouseWheel);
    this.canvas.addEventListener('mousewheel', this._onMouseWheel);

    // moving
    this.mouseLastPos = null;
    this.canvas.addEventListener('mousemove', this._onMouseMove);

    // set target
    this.canvas.addEventListener('click', this._targetClick);
  };

  InputHandler.prototype._onMouseDown = function(evt){
    if(evt.button === 0){ // left/main button
      self.InputHandler.leftMouseButtonDown = true;
    }
  };

  InputHandler.prototype._onMouseUp = function(evt){
    if(evt.button === 0){ // left/main button
      self.InputHandler.leftMouseButtonDown = false;
    }
  };

  InputHandler.prototype._targetClick = function(evt){
    if(evt.shiftKey){
      var target = self.target || { x: 0, y: 0 }
        , rect = self.canvas.getBoundingClientRect()
        , clickPos = {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
      target.x =
            self.visiblePart.x // image offset
          + clickPos.x / self.scale // de-scaled click position
          - self.canvasImage.x / self.scale; // de-scaled canvas offset
      target.y =
            self.visiblePart.y // image offset
          + clickPos.y  / self.scale // de-scaled click position
          - self.canvasImage.y / self.scale; // de-scaled canvas offset
      self.target = target;
    }
  };

  InputHandler.prototype._onMouseWheel = function(evt){
    if (!evt) evt = event;
    evt.preventDefault();
    var zoomFactor = (evt.detail<0 || evt.wheelDelta>0)
                    ? 1 - self.scaleStep  // up -> smaller
                    : 1 + self.scaleStep; // down -> larger
    self.scale = self.scale * zoomFactor;
  };

  InputHandler.prototype._onMouseMove = function(evt){
    var lastPos = self.InputHandler.mouseLastPos
      , rect = self.canvas.getBoundingClientRect()
      , mouseUpPos = {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
    if(lastPos !== null && self.InputHandler.leftMouseButtonDown){
      var deltaX = mouseUpPos.x - lastPos.x
        , deltaY = mouseUpPos.y - lastPos.y;

      self.center.x -= deltaX / self.scale;
      self.center.y -= deltaY / self.scale;
    }
    self.InputHandler.mouseLastPos = mouseUpPos;
  };

  window.ImageViewer = ImageViewer;
}(window));
