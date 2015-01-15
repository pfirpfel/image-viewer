(function (window) {
  "use strict";

  var self;

  function ImageViewer(canvasId, imageUrl){
    self = this;

    // canvas
    this.canvas = document.getElementById(canvasId);
    this.context = this.canvas.getContext("2d");

    // dirty state
    this.dirty = true;

    // image scale
    this.scale = 1;
    this.scaleStep = 0.1;

    // image center (scroll offset)
    this.center = { x: 0, y: 0 };

    // image
    this.image = new Image();
    this.image.addEventListener('load', this._onImageLoad, false);
    this.image.src = imageUrl;

    // buttons
    this.buttons = [];

    // add buttons
    var padding = 10
      , radius = 20
      , x = this.canvas.width - radius - padding
      , y = this.canvas.height - radius - padding;

    var plusButton = new Button(x, y - 50, radius, drawPlusIcon);
    plusButton.onClick = function(){ self.zoomIn(); };
    this.buttons.push(plusButton);

    var minusButton = new Button(x, y, radius, drawMinusIcon);
    minusButton.onClick = function(){ self.zoomOut(); };
    this.buttons.push(minusButton);

    // target point
    this.targetEnabled = false;
    this.target = null;

    // add target button
    var addTargetButton = new Button(x, y - 150, radius, drawTargetIcon);
    // onclick: toggle targetEnabled
    addTargetButton.onClick = function(){
      addTargetButton.enabled = self.targetEnabled = !self.targetEnabled;
      self.dirty = true;
    };
    this.buttons.push(addTargetButton);

    // delete target button
    var deleteTargetButton = new Button(x, y - 100, radius, drawCrossIcon);
    deleteTargetButton.onClick = function(){
      self.target = null;
      self.dirty = true;
    };
    this.buttons.push(deleteTargetButton);

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

    // image changed
    self.dirty = true;

    // stop old render loop (if existed)
    if(self.tickInterval) clearInterval(self.tickInterval);

    // start new render loop
    self.tickInterval = setInterval(function(){ self._render(); }, self.FPS);
  };

  ImageViewer.prototype._render = function(){
    // check if dirty
    if(!this.dirty) return;
    this.dirty = false;

    var ctx = this.context;
    // clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // draw image (transformed and scaled)
    ctx.save();
    var translateX = this.canvas.width / 2 - this.center.x * this.scale
      , translateY = this.canvas.height / 2 - this.center.y * this.scale;

    ctx.translate(translateX, translateY);
    ctx.scale(this.scale, this.scale);

    ctx.drawImage(this.image, 0,0);

    ctx.restore();

    // draw buttons
    this.buttons.forEach(function(button){
      button.draw(ctx);
    });

    // draw target
    if(this.target !== null){
      this._drawTarget();
    }
  };

  ImageViewer.prototype._drawTarget = function(){
    var centerCorrection = { // based on shape below
      x: 0,
      y: -30
    };
    var ctx = this.context;

    ctx.save();

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
    ctx.translate(xTranslation, yTranslation);

    ctx.scale(shapeScale * this.scale, shapeScale * this.scale);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff0000';
    ctx.fillStyle = '#ff0000';

    // flag
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(15, 15);
    ctx.lineTo(15, 5);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, 30);
    ctx.stroke();

    // bulls-eye
    // inner circle
    ctx.beginPath();
    ctx.arc(0, 30, 5, 0, 2 * Math.PI, false);
    ctx.stroke();
    // outer circle
    ctx.beginPath();
    ctx.arc(0, 30, 10, 0, 2 * Math.PI, false);
    ctx.stroke();

    ctx.restore();
  };

  ImageViewer.prototype.zoomIn = function(){
    this.scale = this.scale * (1 + this.scaleStep);
    this.dirty = true;
  };

  ImageViewer.prototype.zoomOut = function(){
    this.scale = this.scale * (1 - this.scaleStep);
    this.dirty = true;
  };

  function Button(x, y, radius, icon){
    // centre coordinates
    this.x = x;
    this.y = y;

    // radius
    this.radius = radius;

    // transparency
    this.alpha = 0.5;

    // color
    this.color = '#000000';

    // icon drawing function
    // (ctx, x, y, radius, icon, color, alpha)
    this.icon = icon;

    // enabled state
    this.enabled = false;
    this.enabledAlpha = 0.7; 

    // click action
    this.onClick = function(){ alert('no click action set!'); };
  }

  Button.prototype.isWithinBounds = function(x, y){
    var dx = Math.abs(this.x - x)
      , dy = Math.abs(this.y - y);
    return  dx * dx + dy * dy <= this.radius * this.radius;
  };

  Button.prototype.draw = function(ctx){
    // preserve context
    ctx.save();

    // drawing settings
    ctx.globalAlpha = (this.enabled) ? this.enabledAlpha : this.alpha;
    ctx.fillStyle= this.color;
    ctx.lineWidth = 0;

    // draw circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    // draw icon
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    this.icon(ctx, this.x, this.y, this.radius);
    ctx.restore();

    // restore context
    ctx.restore();
  };

  function drawMinusIcon(ctx, centerX, centerY, buttonRadius){
    var rectLength = buttonRadius
      , rectThickness = rectLength / 4
      , x = centerX - rectLength / 2
      , y = centerY - rectThickness / 2;

    ctx.fillRect(x, y, rectLength, rectThickness);
  }

  function drawPlusIcon(ctx, centerX, centerY, buttonRadius){
    /*
        11---10
        |     |
    01--12    09--08
    |              |
    02--03    06--07
        |     |
        04---05
    */
    var rectLength = buttonRadius
      , rectThickness = rectLength / 4;

    ctx.beginPath();
    // 1
    ctx.moveTo(centerX - rectLength / 2,
               centerY - rectThickness / 2);
    // 2
    ctx.lineTo(centerX - rectLength / 2,
               centerY + rectThickness / 2);
    // 3
    ctx.lineTo(centerX - rectThickness / 2,
               centerY + rectThickness / 2);
    // 4
    ctx.lineTo(centerX - rectThickness / 2,
               centerY + rectLength / 2);
    // 5
    ctx.lineTo(centerX + rectThickness / 2,
               centerY + rectLength / 2);
    // 6
    ctx.lineTo(centerX + rectThickness / 2,
               centerY + rectThickness / 2);
    // 7
    ctx.lineTo(centerX + rectLength / 2,
               centerY + rectThickness / 2);
    // 8
    ctx.lineTo(centerX + rectLength / 2,
               centerY - rectThickness / 2);
    // 9
    ctx.lineTo(centerX + rectThickness / 2,
               centerY - rectThickness / 2);
    // 10
    ctx.lineTo(centerX + rectThickness / 2,
               centerY - rectLength / 2);
    // 11
    ctx.lineTo(centerX - rectThickness / 2,
               centerY - rectLength / 2);
    // 12
    ctx.lineTo(centerX - rectThickness / 2,
               centerY - rectThickness / 2);

    ctx.closePath();
    ctx.fill();
  }

  function drawTargetIcon(ctx, centerX, centerY, buttonRadius){
    ctx.lineWidth = buttonRadius * 0.3;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, buttonRadius * 0.5, 0, 2 * Math.PI);
    ctx.stroke();
  }

  function drawCrossIcon(ctx, centerX, centerY, buttonRadius){
    ctx.save();
      ctx.translate(centerX, centerY + buttonRadius * 0.7);
      ctx.save();
        ctx.rotate(Math.PI / 4);
        drawPlusIcon(ctx, - buttonRadius / 2, - buttonRadius / 2, buttonRadius);
      ctx.restore();
    ctx.restore();
  }

  function InputHandler(canvas, imageViewer) {
    this.canvas = canvas;
    this.imageViewer = imageViewer;

    // global
    this.leftMouseButtonDown = false;
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
  }
  
  InputHandler.prototype._catchButtonClick = function(evt, executeButton){
    var _executeButton = (executeButton === false) ? false : true;
    // check if a button was clicked
    var rect = self.canvas.getBoundingClientRect()
      , pos = {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
    var clickedButtons = self.buttons.filter(function(button){ return button.isWithinBounds(pos.x, pos.y); });
    if(_executeButton && clickedButtons.length > 0 ){ // button clicked
      clickedButtons[0].onClick();
    }
    return (clickedButtons.length > 0 );  
  }

  InputHandler.prototype._onMouseDown = function(evt){
    // no button clicked
    if(!self.InputHandler._catchButtonClick(evt, false)){
      if(evt.button === 0){ // left/main button
        // set flag for image moving
        self.InputHandler.leftMouseButtonDown = true;
      }
    }
  };

  InputHandler.prototype._onMouseUp = function(evt){
    if(evt.button === 0){ // left/main button
      self.InputHandler.leftMouseButtonDown = false;
    }
  };

  InputHandler.prototype._targetClick = function(evt){
    if(!self.InputHandler._catchButtonClick(evt) && self.targetEnabled){
      var target = self.target || { x: 0, y: 0 }
        , rect = self.canvas.getBoundingClientRect()
        , clickPos = {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
      self.target = convertToImagePosition(clickPos);
      self.dirty = true;
    }
  };

  InputHandler.prototype._onMouseWheel = function(evt){
    if (!evt) evt = event;
    evt.preventDefault();
    if(evt.detail<0 || evt.wheelDelta>0){ // up -> smaller
      self.zoomOut();
    } else { // down -> larger
      self.zoomIn();
    }
  };

  InputHandler.prototype._onMouseMove = function(evt){
    var lastPos = self.InputHandler.mouseLastPos
      , rect = self.canvas.getBoundingClientRect()
      , newPos = {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
    if(lastPos !== null && self.InputHandler.leftMouseButtonDown){
      var deltaX = newPos.x - lastPos.x
        , deltaY = newPos.y - lastPos.y;

      self.center.x -= deltaX / self.scale;
      self.center.y -= deltaY / self.scale;
      self.dirty = true;
    }
    self.InputHandler.mouseLastPos = newPos;
  };

  function convertToImagePosition(canvasPosition){
    var visiblePart = {
          x: self.center.x >= (self.canvas.width / self.scale / 2) ? self.center.x - self.canvas.width / self.scale / 2 : 0,
          y: self.center.y >= (self.canvas.height / self.scale / 2) ? self.center.y - self.canvas.height / self.scale / 2 : 0
      }
      , canvasImage = {
          x: (self.center.x >= (self.canvas.width / self.scale / 2)) ? 0 : self.canvas.width / 2 - self.center.x * self.scale,
          y: (self.center.y >= (self.canvas.height / self.scale / 2)) ? 0 : self.canvas.height / 2 - self.center.y * self.scale
      }
      , imagePosition = {};

    imagePosition.x =
            visiblePart.x // image offset
          + canvasPosition.x / self.scale // de-scaled canvas position
          - canvasImage.x / self.scale; // de-scaled canvas offset
    imagePosition.y =
            visiblePart.y // image offset
          + canvasPosition.y  / self.scale // de-scaled canvas position
          - canvasImage.y / self.scale; // de-scaled canvas offset

    return imagePosition;
  }

  window.ImageViewer = ImageViewer;
}(window));
