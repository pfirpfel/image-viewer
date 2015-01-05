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
    
    // canvas coordinates of image
    this.cx = 0;
    this.cy = 0;
    this.cwidth = 0;
    this.cheight = 0;
    
    // viewed part of the image
    this.sx = 0;
    this.sy = 0;
    this.swidth = 0;
    this.sheight = 0;
    
    // image
    this.image = new Image();
    this.image.addEventListener('load', this._onImageLoad, false);
    this.image.src = imageUrl;
  }
  
  ImageViewer.prototype._onImageLoad = function(){
    if(((self.canvas.height / self.image.height) * self.image.width) <= self.canvas.width){
      self.scale = self.canvas.height / self.image.height;
    } else {
      self.scale = self.canvas.width / self.image.width;
    }
    self.cx = (self.canvas.width - self.image.width * self.scale) / 2;
    self.cy = (self.canvas.height - self.image.height * self.scale) / 2;
    self.cwidth = self.image.width * self.scale;
    self.cheight = self.image.height * self.scale;
    self.swidth = self.image.width;
    self.sheight = self.image.height;
    
    self._render();
  };
  
  ImageViewer.prototype._render = function(){
    // draw image
    this.context.drawImage(
      this.image,
      this.sx, this.sy, this.swidth, this.sheight, // part of image
      this.cx, this.cy, this.cwidth, this.cheight  // position and size within canvas
    );
  };

  window.ImageViewer = ImageViewer;
}(window));
