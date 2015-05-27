(function (window) {
  "use strict";

  function ImageViewer(canvasId, imageUrl, options){
    var self = this;

    // options-object
    // possible start options:
    // * mode:     string (other than default viewer-only mode)
    //             - 'editAnswer'   : displays answer and answer related buttons
    //             - 'editSolution' : displays solution and solution related buttons
    //             - 'showSolution' : displays answer and solution
    // * answer:   position-object, like { x: 0; y: 0; }
    //             position of answer inside the image
    // * solution: array of positions, like [{ x: 0; y: 0; }, { x: 1; y: 1; }]
    //             the positions represent vertices which make up the solution
    //             polygon
    options = (typeof options === 'object') ? options : {};

    // canvas
    var canvas = document.getElementById(canvasId)
      , context = canvas.getContext("2d")

    // dirty state
      , dirty = true

    // flag to stop render loop
      , stopRendering = false

    // image scale
      , scale = 1
      , scaleStep = 0.1

    // image centre (scroll offset)
      , centre = { x: 0, y: 0 }

    // drawing settings
      , defaultLineWidth = 3

    // viewer states
      , states = {
          DEFAULT: 0,
          ANSWER_DRAW: 1,
          SOLUTION_DRAW: 2,
          SOLUTION_MOVE: 3,
          SOLUTION_POINT_DELETE: 4,
          ANNOTATION_SELECT: 5,
          ANNOTATION_DRAW: 6,
          ANNOTATION_MOVE: 7,
          ANNOTATION_DISPLAY: 8
        }
      , state = states.DEFAULT

    // keeping track of event handling
      , events = []

    //// buttons

      // default buttons that are always visible
      , zoomOutButton = new Button('\uf010', 'Zoom out')
      , zoomInButton = new Button('\uf00e', 'Zoom in')
      , defaultButtons = [zoomOutButton, zoomInButton]

      // buttons for answer feature
      , deleteAnswerButton = new Button('\uf1f8', 'Delete answer')
      , addAnswerButton = new Button('\uf024', 'Set answer')
      , answerButtons = [deleteAnswerButton, addAnswerButton]

      // buttons for the solution feature
      , drawSolutionPointButton = new Button('\uf040', 'Draw new solution point (close with shift-click)')
      , moveSolutionButton = new Button('\uf047', 'Move solution point')
      , deleteSolutionPointButton = new Button('\uf00d', 'Delete solution point')
      , deleteSolutionButton = new Button('\uf1f8', 'Delete solution')
      , solutionButtons = [deleteSolutionButton,
                           deleteSolutionPointButton,
                           moveSolutionButton,
                           drawSolutionPointButton]

      // contains all active buttons
      , buttons = defaultButtons.slice()

      // current tool tip (used to track change of tool tip)
      , currentTooltip = null

    // Input handling
      // active element (mainly) used for dragging
      , activeMoveElement = centre
      // track state of left mouse button (even outside the canvas)
      , leftMouseButtonDown = false
      // keep last mouse position to calculate drag distance
      , mouseLastPos = null
      // UI element which is currently in focus, i.e. the mouse is hovering over it
      , focusUIElement = null

    // answer feature
      , answerEditable = (typeof options.mode === 'string' && options.mode === 'editAnswer')
      , answerVisible = answerEditable || (typeof options.mode === 'string' && options.mode === 'showSolution')

    // solution feature
      , solutionEditable = (typeof options.mode === 'string' && options.mode === 'editSolution')
      , solutionVisible = solutionEditable || (typeof options.mode === 'string' && options.mode === 'showSolution')

    // annotation feature
      , annotationsEditable = (typeof options.mode === 'string' && options.mode === 'editAnnotations')
      , annotationsVisible = annotationsEditable || (typeof options.mode === 'string' && options.mode === 'showAnnotations');

    // image
    this.image = new Image();

    // answer
    this.answer = (typeof options.answer === 'object' && options.answer !== null) ? options.answer : null;

    // solution
    this.solution = null;

    // annotations
    // format: { polygon: Polygon-object, color: color-string }
    this.annotations = [];

    function importPolygon(vertexArray){
       if(vertexArray.length < 1){
        return new Polygon();
      }
      var initialVertex = new Vertex(vertexArray[0].x, vertexArray[0].y)
        , current = initialVertex
        , next = null;

      for(var i = 1; i < vertexArray.length; i++){
        next = new Vertex(vertexArray[i].x, vertexArray[i].y);
        if(next.equals(initialVertex)){
          current.next = initialVertex;
          break;
        }
        current.next = next;
        current = next;
      }

      return new Polygon(initialVertex);
    }

    function exportPolygon(polygon){
      // return empty array if polygon is empty
      if(typeof polygon === 'undefined' || polygon === null) return [];

      var exportedPolygon = [];
      var vertices = polygon.getVertices();
      //if closed path, add start point at the end again
      if(vertices[vertices.length - 1].next === vertices[0]) vertices.push(vertices[0]);
      for(var i = 0; i < vertices.length; i++){
        exportedPolygon.push({
          x: vertices[i].position.x,
          y: vertices[i].position.y
        });
      }
      return exportedPolygon;
    }

    this.exportSolution = function(){
      return exportPolygon(this.solution);
    };

    this.importSolution = function(importedSolution){
      this.solution = (importedSolution.length >= 1) ? importPolygon(importedSolution) : null;
      dirty = true;
    };

    this.exportAnnotations = function(){
      return this.annotations.map(function(annotation){
        return {
          color: annotation.color,
          polygon: exportPolygon(annotation.polygon)
        };
      });
    };

    this.importAnnotations = function(importedAnnotations){
      this.annotations = importedAnnotations.map(function(importAnnotation){
        return {
          color: importAnnotation.color,
          polygon: importPolygon(importAnnotation.polygon)
        };
      });
    };

    // gets called if the solution changes
    this.onSolutionChange = function(solution){};

    // gets called if one or more of the annotations change
    this.onAnnotationChange = function(annotations){};

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

      // start new render loop
      render();
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
      // only re-render if dirty
      if(dirty){
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

        // draw solution
        if(solutionVisible && self.solution !== null){
          self.solution.draw(ctx);

          // draw line to mouse cursor
         if(solutionEditable && !self.solution.isClosed()){
            var lastVertexPosition = self.solution.getLastVertex().position
              //, mousePosition = { x: mouseLastPos.x / scale, y: mouseLastPos.y / scale };
              , mousePosition = convertToImagePosition(mouseLastPos)
              , relativePosition = {
                x: mousePosition.x - lastVertexPosition.x,
                y: mousePosition.y - lastVertexPosition.y
              };
              drawLine(ctx, lastVertexPosition, relativePosition, '#FF3300', defaultLineWidth);
          }
        }

        // draw annotations
        if(annotationsVisible){
          self.annotations.forEach(function(annotation){
            annotation.polygon.draw(ctx, annotation.color);
          });
        }

        // draw solution
        if(solutionVisible && self.solution !== null){
          self.solution.draw(ctx);
        }

        // draw answer
        if(answerVisible && self.answer !== null){
          drawAnswer(ctx);
        }

        // draw buttons
        drawButtons(ctx);
      }
      if(!stopRendering) window.requestAnimationFrame(render);
    }

    function drawLine(ctx, from, to, lineColor, lineWidth){
      /**
      * ctx: canvas context
      * from: start-vertex, in image coordinates
      * to: end-vertex, in image coordinates
      * lineColor: color string
      * lineWidth: number, width in pixel
      */

      ctx.save();

      // style
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;

      // draw the line
      var translation = convertToCanvasTranslation(from)
        , drawPos =  { x: 0, y: 0};
      ctx.translate(translation.x, translation.y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(drawPos.x, drawPos.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      ctx.restore();
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

      this.onClick = function(evt){
        if(state === states.SOLUTION_POINT_DELETE){
          self.solution.deleteVertex(vertexInstance);
          self.onSolutionChange(self.exportSolution());
          dirty = true;
          return;
        }
        if(state === states.SOLUTION_DRAW
        && self.solution !== null
        && vertexInstance.equals(self.solution.initialVertex)
        ){
          self.solution.close();
          state = states.DEFAULT;
          self.onSolutionChange(self.exportSolution());
          return;
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

      this.isMouseOver = false;
      this.onMouseIn = function(){
        vertexInstance.isMouseOver = true;
      };

      this.onMouseOut = function(){
        vertexInstance.isMouseOver = false;
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

      ctx.fillStyle = (this.isMouseOver && this == self.solution.initialVertex)
                     ? '#FF6600' // if mouse is hovering over this and a click would close the polygon
                     : '#FFFFFF'; // default
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

    Polygon.prototype.draw = function(ctx, fillColor, strokeColor){
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

        ctx.fillStyle = fillColor || '#0000FF';
        ctx.strokeStyle = strokeColor || '#66FF33';
        if(current === this.initialVertex){
          ctx.strokeStyle = strokeColor || '#000000';
          ctx.closePath();
          ctx.fill();
        }
        ctx.lineWidth = defaultLineWidth;

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

    Polygon.prototype.isClosed = function(){
      var current = this.initialVertex;
      while(current.next !== null && current.next !== this.initialVertex) current = current.next;
      return current.next === this.initialVertex;
    };

    Polygon.prototype.getLastVertex = function(){
      var current = this.initialVertex;
      while(current.next !== null && current.next !== this.initialVertex) current = current.next;
      return current;
    };

    function isLeft(p0, p1, p2){
      // p0, p1, p2: point objects, like { x: 0, y: 0 }
      // returns:
      //          >0 : for p2 left of the line through p0 and p1
      //          =0 : for p2  on the line
      //          <0 : for p2  right of the line
      // see: http://geomalgorithms.com/a01-_area.html
      return ( (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y));
    }

    Polygon.prototype.isWithinBounds = function(x, y){
      // get all vertices
      var vertices = this.getVertices()

      // winding number
        , wn = 0

      // point to check
        , p = { x: x, y: y };

      // if polygon is not closed, the coordinates can't be within bounds
      if(vertices[vertices.length - 1].next !== vertices[0]) return false;

      // algorithm see: http://geomalgorithms.com/a03-_inclusion.html
      for(var i = 0; i + 1 < vertices.length; i++){ // edge from vertices[i] to vertices[i+1]
        if(vertices[i].position.y <= p.y){ // start y <= p.y
          if(vertices[i + 1].position.y > p.y){ // an upward crossing
            if(isLeft(vertices[i].position, vertices[i + 1].position, p) > 0){ // P left of edge
              wn++; // have a valid up intersect
            }
          }
        } else { // start y > p.y
          if(vertices[i + 1].position.y <= p.y){ // a downward crossing
            if(isLeft(vertices[i].position, vertices[i + 1].position, p) < 0){ // P right of  edge
              wn--; // have a valid down intersect
            }
          }
        }
      }

      // wn == 0 only when p is outside
      return wn !== 0;
    };

    Polygon.prototype.close = function(){
      if(this.getVertices().length > 2){
        this.addVertex(this.initialVertex);
      }
    };

    function getAnswerColor(){
      var color = '#0000ff'; // Default: blue

      // change color if answer is within solution
      if(solutionVisible){ // show solution flag enabled?
        // is the answer within the solution?
        if(self.solution !== null
        && self.solution.isWithinBounds(self.answer.x, self.answer.y)){
          color = '#00ff00'; //green
        } else {
          color = '#ff0000'; // red
        }
      }
      return color;
    }

    function drawAnswer(ctx){
      // preserve context
      ctx.save();

      var shapeScale = 1.5
        , transalation = convertToCanvasTranslation(self.answer);

      ctx.translate(transalation.x, transalation.y);
      ctx.scale(shapeScale * scale, shapeScale * scale);
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;

      drawAwesomeIcon(ctx, '\uf05b', getAnswerColor(), 0, 0, 50);

      // restore context
      ctx.restore();
    }

    function getUIElements(){
      // only return the solution vertices handler if in solution edit mode and there are some already
      var solutionVertices = (self.solution !== null && solutionEditable)
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
          if(state === states.ANSWER_DRAW){
            self.answer = convertToImagePosition(clickPos);
            dirty = true;
          }
          if(state === states.SOLUTION_DRAW){
            if(evt.shiftKey){
              // close polygon
              if(self.solution !== null){
                self.solution.close();
                state = states.DEFAULT;
                self.onSolutionChange(self.exportSolution());
              }
            } else {
              var newVertexPosition = convertToImagePosition(clickPos)
                , newVertex = new Vertex(newVertexPosition.x, newVertexPosition.y);
              if(self.solution === null) self.solution = new Polygon();
              self.solution.addVertex(newVertex);
            }
            self.onSolutionChange(self.exportSolution());
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
      mouseLastPos = mouseLastPos || { x: 0, y: 0 };
      var deltaX = newPos.x - mouseLastPos.x
        , deltaY = newPos.y - mouseLastPos.y;
      if(leftMouseButtonDown){
        if(activeMoveElement === centre){
          activeMoveElement.x -= deltaX / scale;
          activeMoveElement.y -= deltaY / scale;
        } else {
          activeMoveElement.x += deltaX / scale;
          activeMoveElement.y += deltaY / scale;
        }
        self.onSolutionChange(self.exportSolution());
        dirty = true;
      } else {
        var activeElement = getUIElement(evt)
          , oldToolTip = currentTooltip;
        if(activeElement !== null){
          if(typeof activeElement.tooltip !== 'undefined'){
            currentTooltip = activeElement.tooltip;
          }
          // new focus UI element?
          if(activeElement !== focusUIElement){
            if(focusUIElement !== null && typeof focusUIElement.onMouseOut !== 'undefined'){
              focusUIElement.onMouseOut();
            }
            focusUIElement = activeElement;
            if(typeof focusUIElement.onMouseIn !== 'undefined'){
              focusUIElement.onMouseIn();
            }
          }
        } else { // no activeElement
          currentTooltip = null;
          if(focusUIElement !== null){
            if(typeof focusUIElement.onMouseOut !== 'undefined'){
              focusUIElement.onMouseOut();
            }
            focusUIElement = null;
          }
        }
        if(oldToolTip !== currentTooltip) dirty = true;
      }
      mouseLastPos = newPos;
      //if(solutionEditable && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 2) dirty = true;
      if(solutionEditable) dirty = true;
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

    function drawAwesomeIcon(ctx, icon, color, centreX, centreY, size){
      // font settings
      ctx.font = size + "px FontAwesome";
      ctx.fillStyle = color;

      // calculate position
      var textSize = ctx.measureText(icon)
        , x = centreX - textSize.width / 2
        , y = centreY + size * 0.7 / 2;

      // draw it
      ctx.fillText(icon, x, y);
    }

    function addEventListener(eventTarget, eventType, listener){
      eventTarget.addEventListener(eventType, listener);
      events.push({eventTarget: eventTarget, eventType: eventType, listener: listener});
    }

    function removeAllEventListeners(){
      var _i, _events = events.slice(), _current;
      for(_i = 0; _i < _events.length; _i++){
        _current = _events[_i];
        _current.eventTarget.removeEventListener(_current.eventType, _current.listener);
      }
      events = [];
    }

    function addEventListeners(){
      // dragging image or ui-elements
      addEventListener(document, 'mousedown', onMouseDown);
      addEventListener(document, 'mouseup', onMouseUp);

      // zooming
      addEventListener(canvas, 'DOMMouseScroll', onMouseWheel);
      addEventListener(canvas, 'mousewheel', onMouseWheel);

      // moving
      addEventListener(canvas, 'mousemove', onMouseMove);

      // setting answer
      addEventListener(canvas, 'click', onMouseClick);
    }

    this.dispose = function(){
      removeAllEventListeners();
      stopRendering = true;
    };

    this.refresh = function(){
      self.dirty = true;
    };

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
      // if answer feature enable, show their buttons
      if(answerEditable){
        // delete answer button
        deleteAnswerButton.onClick = function(){
          self.answer = null;
          dirty = true;
        };
        // add answer button
        addAnswerButton.enabled = function(){
          return (state === states.ANSWER_DRAW);
        };
        // onclick: toggle draw answer mode
        addAnswerButton.onClick = function(){
          state = (state === states.ANSWER_DRAW) ? states.DEFAULT : states.ANSWER_DRAW;
          dirty = true;
        };
        // merge them with the other buttons
        buttons = defaultButtons.concat(answerButtons);
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
          self.onSolutionChange(self.exportSolution());
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
