# HTML5/Canvas Image Viewer

## Features

 * zooming (mouse wheel)
 * moving (by dragging the picture)
 * interactive buttons (for zooming)
 * quiz mode
   * define a solution polygon
   * start in editAnswer-mode to let user set a answer point on the image
   * start in showSolution-mode to show the user if she or he guessed correctly

## Demo

See [here](http://pfirpfel.github.io/image-viewer)!

## Usage

Add a canvas element to your HTML with an id:

```html
<canvas id="viewerCanvas" width="500" height="300"></canvas>
```

Then initialize the viewer in javascript:

```javascript
// start a simple image viewer mit zooming and dragging features
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
    - 'editAnswer'   : displays answer and answer related buttons
    - 'editSolution' : displays solution and solution related buttons
    - 'showSolution' : displays answer and solution
  - answer: position-object (like ```{ x: 0; y: 0; }```); position of answer inside the image
  - solution: array of positions (like ```[{ x: 0; y: 0; }, { x: 1; y: 1; }]```); the positions represent vertices which make up the solution polygon

Example:
```javascript
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', { answer: { x: 0; y: 0; } });
```

### Useful initializations

#### Define a new solution
These settings the tools to create a new solution.

```javascript
var options = {
  mode: 'editSolution'
};
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', options);
```

#### Change an existing solution
These settings display the solution and the tools to change it.

```javascript
var options = {
  mode: 'editSolution',
  solution: [{ x: 0; y: 0; }, { x: 100; y: 100; }, { x: 100; y: 200; }, { x: 0; y: 0; }]
};
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', options);
```

#### Quiz mode
Here the tools to create an answer point are made available to the user.
These settings don't include a solution, to prevent cheating.

```javascript
var options = {
  mode: 'editAnswer'
};
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', options);
```

#### Show a solution
These settings display the solution and the answer without giving the user the possibility to change either.

```javascript
var options = {
  mode: 'showSolution',
  solution: [{ x: 0; y: 0; }, { x: 100; y: 100; }, { x: 100; y: 200; }, { x: 0; y: 0; }],
  answer: { x: 55; y: 55; }
};
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', options);
```

### Changing the image

Change the image.src-property of your image viewer object:
```javascript
myImageViewer.image.src = 'assets/otherImage.png';
```

### Solution
#### Export solution
```javascript
var solution = myImageViewer.exportSolution();
```
The solution is an array of point objects with x/y-coordinates.

#### Import solution
To possibilities:

1. During runtime
```javascript
myImageViewer.importSolution([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
```

2. On initialization
```javascript
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', { solution: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
```
The solution is an array of point objects with x/y-coordinates.

### Solution
#### Accessing answer position
```javascript
var position = myImageViewer.answer;
```
answer is an object like:

```javascript
{ x: 0, y: 0 }
```

#### Setting answer position
To possibilities:

1. During runtime
```javascript
myImageViewer.answer = { x: 0, y: 0 };
myImageViewer.refresh();
```

2. On initialization
```javascript
var myImageViewer = new ImageViewer('viewerCanvas', 'image.png', { asnwer: { x: 0, y: 0 } });
```
