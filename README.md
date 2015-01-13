# HTML5/Canvas Image Viewer

## Features (so far)

 * zooming (mouse wheel)
 * moving (by dragging the picture)
 * interactive buttons (for zooming)

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
