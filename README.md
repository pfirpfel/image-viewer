# HTML5/Canvas Image Viewer

## Features (so far)

 * zooming (mouse wheel)
 * moving (by dragging the picture)
 * interactive buttons (for zooming)
 * "target mode" allows the user to set a point on the image, which can be read from the viewer. useful for quizzes and games.

## Demo

See [here](http://pfirpfel.github.io/image-viewer)!

## Usage

Add a canvas element to your HTML with an id:

```html
<canvas id="viewerCanvas" width="500" height="300"></canvas>
```

Then initialize the viewer in javascript:

```javascript
var myImageViewer = new ImageViewer('viewerCanvas', 'myImage.jpg');
```

That's it!

### Creating the viewer

```javascript
function ImageViewer(canvasId, imageUrl, options)
```

Parameters:

- **canvasId**: id of the canvas element in the HTML DOM
- **imageUrl**: URL of the image to load (can be relative or absolute)
- **options**: object with settings
  - mode: string (other than default viewer-only mode)
    - 'editTarget'   : displays target and target related buttons
    - 'editSolution' : displays solution and solution related buttons
    - 'showSolution' : displays target and solution
  - target: position-object (like ```{ x: 0; y: 0; }```); position of target inside the image
  - solution: array of positions (like ```[{ x: 0; y: 0; }, { x: 1; y: 1; }]```); the positions represent vertices which make up the solution polygon

Example:
```javascript
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', { target: { x: 0; y: 0; } });
```

### Changing the image

Change the image.src-property of your image viewer object:
```javascript
myImageViewer.image.src = 'assets/otherImage.png';
```

### Target mode
#### Accessing target position
```javascript
var position = myImageViewer.target;
```
target is an object like:

```javascript
{ x: 0, y: 0 }
