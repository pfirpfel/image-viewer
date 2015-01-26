(function (window) {
  "use strict";

  function ImageViewer(canvasId, imageUrl, options){
    var self = this;

    options = (typeof options === 'object') ? options : {};

    // canvas
    var canvas = document.getElementById(canvasId)
      , context = canvas.getContext("2d")

    // dirty state
      , dirty = true

    // image scale
      , scale = 1
      , scaleStep = 0.1

    // image centre (scroll offset)
      , centre = { x: 0, y: 0 }

    // viewer states
      , states = {
          DEFAULT: 0,
          TARGET_DRAW: 1,
          SOLUTION_DRAW: 2,
          SOLUTION_MOVE: 3,
          SOLUTION_POINT_DELETE: 4
        }
      , state = states.DEFAULT

    // buttons

      // default buttons that are always visible
      , zoomOutButton = new Button('\uf010', 'Zoom out')
      , zoomInButton = new Button('\uf00e', 'Zoom in')
      , defaultButtons = [zoomOutButton, zoomInButton]

      // buttons for target feature
      , deleteTargetButton = new Button('\uf1f8', 'Delete target')
      , addTargetButton = new Button('\uf024', 'Set target')
      , targetButtons = [deleteTargetButton, addTargetButton]

      // buttons for the solution feature
      , drawSolutionPointButton = new Button('\uf040', 'Draw new solution point')
      , moveSolutionButton = new Button('\uf047', 'Move solution point')
      , deleteSolutionPointButton = new Button('\uf00d', 'Delete solution point')
      , deleteSolutionButton = new Button('\uf1f8', 'Delete solution')
      , solutionButtons = [deleteSolutionButton,
                           deleteSolutionPointButton,
                           moveSolutionButton,
                           drawSolutionPointButton]

      // contains all active buttons
      , buttons = defaultButtons.slice()

      , currentTooltip = null

    // render loop
      , FPS = 30
      , tickInterval = null

    // Input handling
      , activeMoveElement = centre
      , leftMouseButtonDown = false
      , mouseLastPos = null

    // target feature
      , targetEditable = (typeof options.mode === 'string' && options.mode === 'editTarget')
      , targetVisible = targetEditable || (typeof options.mode === 'string' && options.mode === 'showSolution')

    // solution feature
      , solutionEditable = (typeof options.mode === 'string' && options.mode === 'editSolution')
      , solutionVisible = solutionEditable || (typeof options.mode === 'string' && options.mode === 'showSolution');

    // image
    this.image = new Image();

    // target
    this.target = (typeof options.target === 'object' && options.target !== null) ? options.target : null;

    // solution
    this.solution = null;

    this.exportSolution = function(){
      // return empty array if solution is empty
      if(this.solution === null) return [];

      var exportedSolution = [];
      var vertices = this.solution.getVertices();
      //if closed path, add start point at the end again
      if(vertices[vertices.length - 1].next === vertices[0]) vertices.push(vertices[0]);
      for(var i = 0; i < vertices.length; i++){
        exportedSolution.push({
          x: vertices[i].position.x,
          y: vertices[i].position.y
        });
      }
      return exportedSolution;
    };

    this.importSolution = function(importedSolution){
      if(importedSolution.length < 1){
        this.solution = null;
        return;
      }
      var initialVertex = new Vertex(importedSolution[0].x, importedSolution[0].y)
        , current = initialVertex
        , next = null;

      for(var i = 1; i < importedSolution.length; i++){
        next = new Vertex(importedSolution[i].x, importedSolution[i].y);
        if(next.equals(initialVertex)){
          current.next = initialVertex;
          break;
        }
        current.next = next;
        current = next;
      }

      this.solution = new Polygon(initialVertex);
      dirty = true;
    };

    function onImageLoad(){
      // set scale to use as much space inside the canvas as possible
      if(((canvas.height / self.image.height) * self.image.width) <= canvas.width){
        scale = canvas.height / self.image.height;
      } else {
        scale = canvas.width / self.image.width;
      }

      // centre at image centre
      centre.x = self.image.width / 2;
      centre.y = self.image.height / 2;

      // image changed
      dirty = true;

      // stop old render loop (if existed)
      if(tickInterval) clearInterval(tickInterval);

      // start new render loop
      tickInterval = setInterval(function(){ render(); }, 1000 / FPS);
    }

    this.zoomIn = function(){
      scale = scale * (1 + scaleStep);
      dirty = true;
    };

    this.zoomOut = function(){
      scale = scale * (1 - scaleStep);
      dirty = true;
    };

    function render(){
      // check if dirty
      if(!dirty) return;
      dirty = false;

      var ctx = context;
      // clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw image (transformed and scaled)
      ctx.save();
      var translateX = canvas.width / 2 - centre.x * scale
        , translateY = canvas.height / 2 - centre.y * scale;

      ctx.translate(translateX, translateY);
      ctx.scale(scale, scale);

      ctx.drawImage(self.image, 0,0);

      ctx.restore();

      // draw buttons
      drawButtons(ctx);

      if(solutionVisible && self.solution !== null){
        self.solution.draw(ctx);
      }

      // draw target
      if(targetVisible && self.target !== null){
        drawTarget(ctx);
      }
    }

    function drawButtons(ctx){
      var padding = 10
        , radius = 20
        , gap = 2 * radius + padding
        , x = canvas.width - radius - padding
        , y = canvas.height - radius - padding;

      // draw buttons
      for(var i = 0; i < buttons.length; i++){
        buttons[i].draw(ctx, x, y - gap * i, radius);
      }

      // draw tooltip
      if(currentTooltip !== null){
        ctx.save();
        ctx.globalAlpha = 0.5;
        var fontSize = radius;
        ctx.font = fontSize + "px sans-serif";

        // calculate position
        var textSize = ctx.measureText(currentTooltip).width
          , rectWidth = textSize + padding
          , rectHeight = fontSize * 0.70 + padding
          , rectX = canvas.width
                    - (2 * radius + 2 * padding) // buttons
                    - rectWidth
          , rectY = canvas.height - rectHeight - padding
          , textX = rectX + 0.5 * padding
          , textY = canvas.height - 1.5 * padding;

        ctx.fillStyle = '#000000';
        drawRoundRectangle(ctx, rectX, rectY, rectWidth, rectHeight, 8, true, false);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(currentTooltip, textX, textY);

        ctx.restore();
      }
    }

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

    function convertToImagePosition(canvasPosition){
      var visiblePart = {
            x: centre.x >= (canvas.width / scale / 2) ? centre.x - canvas.width / scale / 2 : 0,
            y: centre.y >= (canvas.height / scale / 2) ? centre.y - canvas.height / scale / 2 : 0
        }
        , canvasImage = {
            x: (centre.x >= (canvas.width / scale / 2)) ? 0 : canvas.width / 2 - centre.x * scale,
            y: (centre.y >= (canvas.height / scale / 2)) ? 0 : canvas.height / 2 - centre.y * scale
        }
        , imagePosition = {};

      imagePosition.x =
              visiblePart.x // image offset
            + canvasPosition.x / scale // de-scaled canvas position
            - canvasImage.x / scale; // de-scaled canvas offset
      imagePosition.y =
              visiblePart.y // image offset
            + canvasPosition.y  / scale // de-scaled canvas position
            - canvasImage.y / scale; // de-scaled canvas offset

      return imagePosition;
    }

    function convertToCanvasTranslation(imagePosition){
      return {
        x: (
              imagePosition.x  // x-position on picture
            + canvas.width / scale / 2 // offset of scaled canvas
            - centre.x // scroll offset of image
           ) * scale, // scale the transformation

        y: (
              imagePosition.y  // y-position on picture
            + canvas.height / scale / 2 // offset of scaled canvas
            - centre.y // scroll offset of image
           ) * scale // scale the transformation
      };
    }

    function Vertex(x, y) {
      var vertexInstance = this;

      var pos = this.position = {
        x: x,
        y: y
      };

      this.next = null;

      this.handleWidth = 12;

      this.onClick = function(){
        if(state === states.SOLUTION_POINT_DELETE){
          self.solution.deleteVertex(vertexInstance);
          dirty = true;
        }
      };

      this.onMouseDown = function(){
        if(state === states.SOLUTION_MOVE){
          activeMoveElement = pos;
          leftMouseButtonDown = true;
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
      dirty = true;
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
      if(this.initialVertex !== null && this.initialVertex.next !== null){
        var drawPos =  { x: 0, y: 0}
          , current = this.initialVertex
          , next
          , translation = convertToCanvasTranslation(this.initialVertex.position)
          ;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.translate(translation.x, translation.y);
        ctx.scale(scale, scale);
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
      if(solutionEditable){
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

    function drawTarget(ctx){
      // preserve context
      ctx.save();

      var shapeScale = 1.5
        , transalation = convertToCanvasTranslation(self.target);

      ctx.translate(transalation.x, transalation.y);
      ctx.scale(shapeScale * scale, shapeScale * scale);
      ctx.lineWidth = 2;
      var color = '#0000ff'; // blue

      // change color if target is within solution
      if(solutionVisible // show solution flag enabled?
         && self.solution !== null){ // is there a solution?
        // is the target within the solution?
        if(self.solution.isWithinBounds(self.target.x, self.target.y)){
          color = '#00ff00'; //green
        } else {
          color = '#ff0000'; // red
        }
      }

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
    }

    function getUIElements(){
      // only return the solution vertices handler if in solution drawing mode and there are some already
      var solutionVertices = (self.solution !== null)
                             ? self.solution.getVertices()
                             : [];
      return buttons.concat(solutionVertices);
    }

    function getUIElement(evt){
      var rect = canvas.getBoundingClientRect()
        , pos = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
          }
        , activeUIElement =
              getUIElements()
              .filter(function(button){
                return button.isWithinBounds(pos.x, pos.y);
              });
      return (activeUIElement.length > 0 ) ? activeUIElement[0] : null;
    }

    function onMouseDown(evt){
      if(evt.button === 0){ // left/main button
        var activeElement = getUIElement(evt);
        if(activeElement === null || !activeElement.onMouseDown(evt)){
          // set flag for image moving
          leftMouseButtonDown = true;
        }
      }
    }

    function onMouseUp(evt){
      if(evt.button === 0){ // left/main button
        activeMoveElement = centre;
        leftMouseButtonDown = false;
      }
    }

    function onMouseClick(evt){
      if(evt.button === 0){ // left/main button
        var activeElement = getUIElement(evt);
        if(activeElement !== null){
          activeElement.onClick(evt);
        } else {
          var rect = canvas.getBoundingClientRect()
            , clickPos = {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
              };
          if(state === states.TARGET_DRAW){
            self.target = convertToImagePosition(clickPos);
            dirty = true;
          }
          if(state === states.SOLUTION_DRAW){
            if(evt.shiftKey){
              // close polygon if it has more than 2 vertices
              if(self.solution !== null && self.solution.getVertices().length > 2){
                self.solution.addVertex(self.solution.initialVertex);
                state = states.DEFAULT;
              }
            } else {
              var newVertexPosition = convertToImagePosition(clickPos)
                , newVertex = new Vertex(newVertexPosition.x, newVertexPosition.y);
              if(self.solution === null) self.solution = new Polygon();
              self.solution.addVertex(newVertex);
            }
            dirty = true;
          }
        }
      }
    }

    function onMouseWheel(evt){
      if (!evt) evt = event;
      evt.preventDefault();
      if(evt.detail < 0 || evt.wheelDelta > 0){ // up -> smaller
        self.zoomOut();
      } else { // down -> larger
        self.zoomIn();
      }
    }

    function onMouseMove(evt){
      var rect = canvas.getBoundingClientRect()
        , newPos = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
          };
      if(mouseLastPos !== null && leftMouseButtonDown){
        var deltaX = newPos.x - mouseLastPos.x
          , deltaY = newPos.y - mouseLastPos.y;

        if(activeMoveElement === centre){
          activeMoveElement.x -= deltaX / scale;
          activeMoveElement.y -= deltaY / scale;
        } else {
          activeMoveElement.x += deltaX / scale;
          activeMoveElement.y += deltaY / scale;
        }
        dirty = true;
      } else {
        var activeElement = getUIElement(evt)
          , oldToolTip = currentTooltip;
        if(activeElement !== null && typeof activeElement.tooltip !== 'undefined'){
          currentTooltip = activeElement.tooltip;
        } else {
          currentTooltip = null;
        }
        if(oldToolTip !== currentTooltip) dirty = true;
      }
      mouseLastPos = newPos;
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
      if(this.drawPosition === null) return false;
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

    function drawAwesomeIcon(ctx, icon, color, centreX, centreY, buttonRadius){
      // font settings
      ctx.font = buttonRadius + "px FontAwesome";
      ctx.fillStyle = color;

      // calculate position
      var textSize = ctx.measureText(icon)
        , x = centreX - textSize.width / 2
        , y = centreY + buttonRadius * 0.7 / 2;

      // draw it
      ctx.fillText(icon, x, y);
    }

    function addEventListeners(){
      // dragging image or ui-elements
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mouseup', onMouseUp);

      // zooming
      canvas.addEventListener('DOMMouseScroll', onMouseWheel);
      canvas.addEventListener('mousewheel', onMouseWheel);

      // moving
      canvas.addEventListener('mousemove', onMouseMove);

      // setting target
      canvas.addEventListener('click', onMouseClick);
    }

    function removeEventListeners(){
      // dragging image or ui-elements
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);

      // zooming
      canvas.removeEventListener('DOMMouseScroll', onMouseWheel);
      canvas.removeEventListener('mousewheel', onMouseWheel);

      // moving
      canvas.removeEventListener('mousemove', onMouseMove);

      // setting target
      canvas.removeEventListener('click', onMouseClick);
    }

    this.dispose = function(){
      removeEventListeners();
      clearInterval(tickInterval);
    };

    this.refresh = function(){
      self.dirty = true;
    }

    function initialize(){
      //// init image
      self.image.addEventListener('load', onImageLoad, false);
      self.image.src = imageUrl;

      //// init solution
      if(Object.prototype.toString.call(options.solution) === '[object Array]')
        self.importSolution(options.solution);

      //// init buttons
      // apply zooming functions to their buttons
      zoomOutButton.onClick = function(){ self.zoomOut(); };
      zoomInButton.onClick = function(){ self.zoomIn(); };
      // if target feature enable, show their buttons
      if(targetEditable){
        // delete target button
        deleteTargetButton.onClick = function(){
          self.target = null;
          dirty = true;
        };
        // add target button
        addTargetButton.enabled = function(){
          return (state === states.TARGET_DRAW);
        };
        // onclick: toggle draw target mode
        addTargetButton.onClick = function(){
          state = (state === states.TARGET_DRAW) ? states.DEFAULT : states.TARGET_DRAW;
          dirty = true;
        };
        // merge them with the other buttons
        buttons = defaultButtons.concat(targetButtons);
      }
      // if solution feature enable, show their buttons
      if(solutionEditable){
        drawSolutionPointButton.enabled = function(){
          return (state === states.SOLUTION_DRAW);
        };
        drawSolutionPointButton.onClick = function(){
          state = (state === states.SOLUTION_DRAW)
                        ? states.DEFAULT
                        : states.SOLUTION_DRAW;
          dirty = true;
        };
        moveSolutionButton.enabled = function(){
          return (state === states.SOLUTION_MOVE);
        };
        moveSolutionButton.onClick = function(){
          state = (state === states.SOLUTION_MOVE)
                        ? states.DEFAULT
                        : states.SOLUTION_MOVE;
          dirty = true;
        };
        deleteSolutionPointButton.enabled = function(){
          return (state === states.SOLUTION_POINT_DELETE);
        };
        deleteSolutionPointButton.onClick = function(){
          state = (state === states.SOLUTION_POINT_DELETE)
                        ? states.DEFAULT
                        : states.SOLUTION_POINT_DELETE;
          dirty = true;
        };
        deleteSolutionButton.onClick = function(){
          self.solution = null;
          dirty = true;
        };

        // merge them with the other buttons
        buttons = defaultButtons.concat(solutionButtons);
      }

      //// init Input handling
      addEventListeners();
    }

    initialize();
  }

  window.ImageViewer = ImageViewer;
}(window));
