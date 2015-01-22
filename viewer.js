(function (window) {
  "use strict";

  var self;

  // hiddenFlags
  var solutionVisible = false;

  function ImageViewer(canvasId, imageUrl, options){
    self = this;

    options = (typeof options === 'object') ? options : {};

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

    this.states = {
      DEFAULT: 0,
      TARGET_DRAW: 1,
      SOLUTION_DRAW: 2,
      SOLUTION_MOVE: 3,
      SOLUTION_POINT_DELETE: 4
    };
    this.state = this.states.DEFAULT;

    // buttons
    this.buttons = [];
    this.currentTooltip = null;

    // add buttons
    var padding = 10
      , radius = 20
      , x = this.canvas.width - radius - padding
      , y = this.canvas.height - radius - padding;

    this.defaultButtons = [];

    var zoomOutButton = new Button('\uf010', 'Zoom out');
    zoomOutButton.onClick = function(){ self.zoomOut(); };
    this.defaultButtons.push(zoomOutButton);

    var zoomInButton = new Button('\uf00e', 'Zoom in');
    zoomInButton.onClick = function(){ self.zoomIn(); };
    this.defaultButtons.push(zoomInButton);

    this.buttons = this.defaultButtons.slice();

    // setup target feature
    this.targetFeatureEnabled = (typeof options.target === 'boolean') ? options.target : false;
    // if target feature was enabled in the options, start it
    if(this.targetFeatureEnabled) this.enableTargetMode();

    this.target = null;
    this.targetButtons = [];

    // delete target button
    var deleteTargetButton = new Button('\uf1f8', 'Delete target');
    deleteTargetButton.onClick = function(){
      self.target = null;
      self.dirty = true;
    };
    this.targetButtons.push(deleteTargetButton);

    // add target button
    var addTargetButton = new Button('\uf024', 'Set target');
    addTargetButton.enabled = function(){
      return (self.state === self.states.TARGET_DRAW);
    };
    // onclick: toggle draw target mode
    addTargetButton.onClick = function(){
      self.state = (self.state === self.states.TARGET_DRAW) ? self.states.DEFAULT : self.states.TARGET_DRAW;
      self.dirty = true;
    };
    this.targetButtons.push(addTargetButton);


    this.solutionPolygon = null;
    var drawSolutionPointButton = new Button('\uf040', 'Draw new solution point')
      , moveSolutionButton = new Button('\uf047', 'Move solution point')
      , deleteSolutionPointButton = new Button('\uf00d', 'Delete solution point')
      , deleteSolutionButton = new Button('\uf1f8', 'Delete solution');
    this.solutionButtons = [ deleteSolutionButton,
                             deleteSolutionPointButton,
                             moveSolutionButton,
                             drawSolutionPointButton];
    drawSolutionPointButton.enabled = function(){
      return (self.state === self.states.SOLUTION_DRAW);
    };
    drawSolutionPointButton.onClick = function(){
      self.state = (self.state === self.states.SOLUTION_DRAW)
                    ? self.states.DEFAULT
                    : self.states.SOLUTION_DRAW;
      self.dirty = true;
    };
    moveSolutionButton.enabled = function(){
      return (self.state === self.states.SOLUTION_MOVE);
    };
    moveSolutionButton.onClick = function(){
      self.state = (self.state === self.states.SOLUTION_MOVE)
                    ? self.states.DEFAULT
                    : self.states.SOLUTION_MOVE;
      self.dirty = true;
    };
    deleteSolutionPointButton.enabled = function(){
      return (self.state === self.states.SOLUTION_POINT_DELETE);
    };
    deleteSolutionPointButton.onClick = function(){
      self.state = (self.state === self.states.SOLUTION_POINT_DELETE)
                    ? self.states.DEFAULT
                    : self.states.SOLUTION_POINT_DELETE;
      self.dirty = true;
    };
    deleteSolutionButton.onClick = function(){
      self.solutionPolygon = null;
      self.dirty = true;
    };

    var exposeSolutionOption = (typeof options.exposeSolution === 'boolean') ? options.exposeSolution : false;
    this.solutionMenuVisible = false;
    if(exposeSolutionOption){
      this.getSolutionVisible = function(){return solutionVisible;};
      this.setSolutionVisible = function(value){
        solutionVisible = value;
        this.dirty = true;
      };
      this.showSolutionMenu = function(){
        solutionVisible = true;
        this.buttons = this.defaultButtons.concat(this.solutionButtons);
        this.solutionMenuVisible = true;
        this.dirty = true;
      };
      this.hideSolutionMenu = function(){
        solutionVisible = false;
        this.buttons = this.defaultButtons.slice();
        this.solutionMenuVisible = false;
        this.dirty = true;
      };
    }

    // render loop
    this.FPS = 30;
    this.tickInterval = null;

    this.InputHandler = new InputHandler(this.canvas, this);
    this.activeMoveElement = this.center;
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
    self.tickInterval = setInterval(function(){ self._render(); }, 1000 / self.FPS);
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
    this._drawButtons(ctx);

    if(solutionVisible && this.solutionPolygon !== null){
      this.solutionPolygon.draw(this.context);
    }

    // draw target
    if(this.target !== null){
      this._drawTarget(this.context);
    }
  };

  ImageViewer.prototype._drawButtons = function(ctx){
    var padding = 10
      , radius = 20
      , gap = 2 * radius + padding
      , x = this.canvas.width - radius - padding
      , y = this.canvas.height - radius - padding;

    // draw buttons
    for(var i = 0; i < this.buttons.length; i++){
      this.buttons[i].draw(ctx, x, y - gap * i, radius);
    }

    // draw tooltip
    if(this.currentTooltip != null){
      ctx.save();
      ctx.globalAlpha = 0.5;
      var fontSize = radius;
      ctx.font = fontSize + "px sans-serif";

      // calculate position
      var textSize = ctx.measureText(this.currentTooltip).width
        , rectWidth = textSize + padding
        , rectHeight = fontSize * 0.70 + padding
        , rectX = this.canvas.width
                  - (2 * radius+ + 2 * padding) // buttons
                  - rectWidth
        , rectY = this.canvas.height - rectHeight - padding
        , textX = rectX + 0.5 * padding
        , textY = this.canvas.height - 1.5 * padding;

      ctx.fillStyle = '#000000';
      drawRoundRectangle(ctx, rectX, rectY, rectWidth, rectHeight, 8, true, false);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.currentTooltip, textX, textY);

      ctx.restore();
    }
  };

  ImageViewer.prototype.enableTargetMode = function(){
    this.buttons = this.defaultButtons.concat(this.targetButtons);
    this.targetFeatureEnabled = true;
    this.dirty = true;
  };

  ImageViewer.prototype.disableTargetMode = function(){
    this.buttons = this.defaultButtons.slice();
    this.targetFeatureEnabled = false;
    self.state = self.states.DEFAULT;
    this.target = null;
    this.dirty = true;
  };

  ImageViewer.prototype._drawTarget = function(ctx){
    // preserve context
    ctx.save();

    var shapeScale = 1.5
      , transalation = convertToCanvasTranslation(this.target);

    ctx.translate(transalation.x, transalation.y);
    ctx.scale(shapeScale * this.scale, shapeScale * this.scale);
    ctx.lineWidth = 2;
    var color = '#ff0000'; // red

    // TODO make this behaviour optional
    // change color if target is within solution
    if(solutionVisible // show solution flag enabled?
       && this.solutionPolygon !== null // is there a solution?
       && this.solutionPolygon.isWithinBounds(this.target.x, this.target.y)) // os the target within the solution?
      color = '#00ff00'; //green

    ctx.strokeStyle = ctx.fillStyle = color;

    // flag
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(15, -15);
    ctx.lineTo(15, -25);
    ctx.lineTo(0, -30);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // bulls-eye
    // inner circle
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, 2 * Math.PI, false);
    ctx.stroke();
    // outer circle
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 2 * Math.PI, false);
    ctx.stroke();

    // restore context
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

  ImageViewer.prototype.getUIElements = function(){
    // only return the solution vertices handler if in solution drawing mode and there are some already
    var solutionVertices = (this.solutionPolygon !== null)
                           ? this.solutionPolygon.getVertices()
                           : [];
    return this.buttons.concat(solutionVertices);
  };

  function drawRoundRectangle(ctx, x, y, width, height, radius, fill, stroke){
    radius = (typeof radius === 'number') ? radius : 5;
    fill = (typeof fill === 'boolean') ? fill : true; // fill = default
    stroke = (typeof stroke === 'boolean') ? stroke : false;

    // draw round rectangle
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  function Button(icon, tooltip){
    // drawn on position
    this.drawPosition = null;
    this.drawRadius = 0;

    // transparency
    this.alpha = 0.5;

    // color
    this.color = '#000000';

    // icon unicode from awesome font
    this.icon = icon;
    this.iconColor = '#ffffff';

    // tooltip
    this.tooltip = tooltip || null;

    // enabled state
    this.enabled = false;
    this.enabledAlpha = 0.7; 

    // click action
    this.onClick = function(){ alert('no click action set!'); };

    // mouse down action
    this.onMouseDown = function(){ return false; };
  }

  Button.prototype.isWithinBounds = function(x, y){
    var dx = Math.abs(this.drawPosition.x - x)
      , dy = Math.abs(this.drawPosition.y - y);
    return  dx * dx + dy * dy <= this.drawRadius * this.drawRadius;
  };

  Button.prototype.draw = function(ctx, x, y, radius){
    this.drawPosition = { x: x, y: y };
    this.drawRadius = radius;

    // preserve context
    ctx.save();

    // drawing settings
    var isEnabled = (typeof this.enabled === 'function') ? this.enabled() : this.enabled;
    ctx.globalAlpha = (isEnabled) ? this.enabledAlpha : this.alpha;
    ctx.fillStyle= this.color;
    ctx.lineWidth = 0;

    // draw circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    // draw icon
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    drawAwesomeIcon(ctx, this.icon, this.iconColor, x, y, radius);
    ctx.restore();

    // restore context
    ctx.restore();
  };

  function drawAwesomeIcon(ctx, icon, color, centerX, centerY, buttonRadius){
    // font settings
    ctx.font = buttonRadius + "px FontAwesome";
    ctx.fillStyle = color;

    // calculate position
    var textSize = ctx.measureText(icon)
      , x = centerX - textSize.width / 2
      , y = centerY + buttonRadius * 0.7 / 2;

    // draw it
    ctx.fillText(icon, x, y);
  }

  function Vertex(x, y) {
    var that = this;

    var pos = this.position = {
      x: x,
      y: y
    };

    this.next = null;

    this.handleWidth = 12;

    this.onClick = function(){
      if(self.state === self.states.SOLUTION_POINT_DELETE){
        self.solutionPolygon.deleteVertex(that);
        self.dirty = true;
      }
    };

    this.onMouseDown = function(){
      if(self.state === self.states.SOLUTION_MOVE){
        self.activeMoveElement = pos;
        self.InputHandler.leftMouseButtonDown = true;
        return true;
      }
      return false;
    };
  }

  Vertex.prototype.equals = function(other){
    return this.position.x === other.position.x
        && this.position.y === other.position.y;
  };

  Vertex.prototype.isWithinBounds = function(x, y){
    var canvasPosition = convertToCanvasTranslation(this.position);

    return x >= canvasPosition.x - this.handleWidth / 2 && x <= canvasPosition.x + this.handleWidth / 2
        && y >= canvasPosition.y - this.handleWidth / 2 && y <= canvasPosition.y + this.handleWidth / 2;
  };

  Vertex.prototype.drawHandle = function(ctx){
    // preserve context
    ctx.save();

    var translation = convertToCanvasTranslation(this.position);
    ctx.translate(translation.x, translation.y);

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';

    ctx.beginPath();
    ctx.rect(-this.handleWidth/2, // x
             -this.handleWidth/2, // y
             this.handleWidth, // width
             this.handleWidth); // height
    ctx.stroke();
    ctx.fill();

    // restore context
    ctx.restore();
  };

  function Polygon(initialVertex){
    this.initialVertex = initialVertex || null;
  }

  Polygon.prototype.addVertex = function(vertex){
    if(this.initialVertex !== null){
      var last = this.initialVertex;
      while(last.next !== null && last.next !== this.initialVertex){
        last = last.next;
      }
      last.next = vertex;
    } else {
      this.initialVertex = vertex;
    }
    self.dirty = true;
  };

  Polygon.prototype.deleteVertex = function(vertex){
    if(this.initialVertex !== null && this.initialVertex.equals(vertex)){
      this.initialVertex = this.initialVertex.next;
    } else {
      var deleted = false 
        , current = this.initialVertex
        , next = current.next;

      while(!deleted && next !== null && next !== this.initialVertex){
        if(next.equals(vertex)){
          current.next = next.next;
          deleted = true;
        } else {
          current = next;
          next = current.next;
        }
      }
    }
  };

  Polygon.prototype.getVertices = function(){
    var vertices = [], currentVertex = this.initialVertex;
    while(currentVertex !== null){
      if(vertices.indexOf(currentVertex) === -1){
        vertices.push(currentVertex);
      }
      currentVertex = (currentVertex.next !== this.initialVertex) ? currentVertex.next : null;
    }
    return vertices;
  };

  Polygon.prototype.draw = function(ctx){
    // only draw lines or polygon if there is more than one vertex
    if(this.initialVertex.next !== null){
      var drawPos =  { x: 0, y: 0}
        , current = this.initialVertex
        , next
        , translation = convertToCanvasTranslation(this.initialVertex.position)
        ;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.translate(translation.x, translation.y);
      ctx.scale(self.scale,self.scale);
      ctx.beginPath();
      ctx.moveTo(drawPos.x, drawPos.y);
      do {
        next = current.next;
        drawPos = {
          x: drawPos.x + (next.position.x - current.position.x),
          y: drawPos.y + (next.position.y - current.position.y)
        };
        ctx.lineTo(drawPos.x, drawPos.y);
        current = next;
      } while(current.next !== null && current !== this.initialVertex);

      ctx.fillStyle = '#0000FF';
      if(current === this.initialVertex){
        ctx.closePath();
        ctx.fill();
      }

      ctx.stroke();
      ctx.restore();
    }

    // draw handles
    if(self.solutionMenuVisible){
      this.getVertices().forEach(function(handle){
        handle.drawHandle(ctx);
      });
    }
  };

  Polygon.prototype.isWithinBounds = function(x, y){
    // get all vertices
    var vertices = this.getVertices();
    // if polygon is not closed, the coordinates can't be within bounds
    if(vertices[vertices.length - 1].next !== vertices[0]) return false;

    // algorithm from: http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    var i = 0
      , j = vertices.length - 1
      , inBounds = false;
    for(; i < vertices.length; j = i++){
      if(((vertices[i].position.y > y) !== (vertices[j].position.y > y)) &&
         (x < (vertices[j].position.x - vertices[i].position.x) * (y - vertices[i].position.y)
            / (vertices[j].position.y - vertices[i].position.y) + vertices[i].position.x)
      ){
         inBounds = !inBounds;
      }
    }
    return inBounds;
  };

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
    this.canvas.addEventListener('click', this._onMouseClick);
  }
  
  InputHandler.prototype._getUIElement = function(evt){
    var rect = self.canvas.getBoundingClientRect()
      , pos = {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
    var activeUIElement =
            self.getUIElements()
                .filter(function(button){
                  return button.isWithinBounds(pos.x, pos.y);
                });

    return (activeUIElement.length > 0 ) ? activeUIElement[0] : null;
  };

  InputHandler.prototype._onMouseDown = function(evt){
    if(evt.button === 0){ // left/main button
      var activeElement = self.InputHandler._getUIElement(evt);
      if(activeElement === null || !activeElement.onMouseDown(evt)){
        // set flag for image moving
        self.InputHandler.leftMouseButtonDown = true;
      }
    }
  };

  InputHandler.prototype._onMouseUp = function(evt){
    if(evt.button === 0){ // left/main button
      self.activeMoveElement = self.center;
      self.InputHandler.leftMouseButtonDown = false;
    }
  };

  InputHandler.prototype._onMouseClick = function(evt){
    if(evt.button === 0){ // left/main button
      var activeElement = self.InputHandler._getUIElement(evt);
      if(activeElement !== null){
        activeElement.onClick(evt);
      } else {
        var rect = self.canvas.getBoundingClientRect()
          , clickPos = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
          };
        if(self.state === self.states.TARGET_DRAW){
          var target = self.target || { x: 0, y: 0 };
          self.target = convertToImagePosition(clickPos);
          self.dirty = true;
        }
        if(self.state === self.states.SOLUTION_DRAW){
          if(evt.shiftKey){
            if(self.solutionPolygon !== null && self.solutionPolygon.getVertices().length > 2){
              // close polygon
              self.solutionPolygon.addVertex(self.solutionPolygon.initialVertex);
              self.state = self.states.DEFAULT;
            }
          } else {
            var newVertexPosition = convertToImagePosition(clickPos)
              , newVertex = new Vertex(newVertexPosition.x, newVertexPosition.y);
            if(self.solutionPolygon === null) self.solutionPolygon = new Polygon();
            self.solutionPolygon.addVertex(newVertex);
          }
          self.dirty = true;
        }
      }
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

      if(self.activeMoveElement === self.center){
        self.activeMoveElement.x -= deltaX / self.scale;
        self.activeMoveElement.y -= deltaY / self.scale;
      } else {
        self.activeMoveElement.x += deltaX / self.scale;
        self.activeMoveElement.y += deltaY / self.scale;
      }
      self.dirty = true;
    } else {
      var activeElement = self.InputHandler._getUIElement(evt)
        , oldToolTip = self.currentTooltip;
      if(activeElement !== null && typeof activeElement.tooltip !== 'undefnied'){
        self.currentTooltip = activeElement.tooltip;
      } else {
        self.currentTooltip = null;
      }
      if(oldToolTip !== self.currentTooltip) self.dirty = true;
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

  function convertToCanvasTranslation(imagePosition){
    return {
      x: (
            imagePosition.x  // x-position on picture
          + self.canvas.width / self.scale / 2 // offset of scaled canvas
          - self.center.x // scroll offset of image
         ) * self.scale, // scale the transformation

      y: (
            imagePosition.y  // y-position on picture
          + self.canvas.height / self.scale / 2 // offset of scaled canvas
          - self.center.y // scroll offset of image
         ) * self.scale // scale the transformation
    };
  }

  window.ImageViewer = ImageViewer;
}(window));
