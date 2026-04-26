# Web Development Learning Guide: HTML, CSS, JavaScript

## 1. HTML (HyperText Markup Language)
- **Purpose:** Structure the content of web pages.
- **Basic Structure:**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Page Title</title>
  </head>
  <body>
    <h1>Heading</h1>
    <p>Paragraph text.</p>
    <a href="https://example.com">A link</a>
  </body>
</html>
```
- **Common Elements:**
  - `<div>`: Block container
  - `<span>`: Inline container
  - `<img src="...">`: Image
  - `<ul>`, `<li>`: Unordered list and list item
  - `<button>`: Clickable button

## 2. CSS (Cascading Style Sheets)
- **Purpose:** Style and layout for HTML elements.
- **Basic Syntax:**
```css
selector {
  property: value;
}
```
- **Examples:**
```css
body {
  background: #f0f0f0;
  color: #222;
}
#main {
  width: 80%;
  margin: auto;
}
.button {
  background: blue;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
}
```
- **Selectors:**
  - `#id` targets an element with a specific id
  - `.class` targets all elements with a class
  - `element` targets all elements of that type

## 3. JavaScript (JS)
- **Purpose:** Add interactivity and logic to web pages.
- **Basic Usage:**
```html
<script>
  function sayHello() {
    alert('Hello!');
  }
</script>
<button onclick="sayHello()">Click Me</button>
```
- **DOM Manipulation:**
```js
document.getElementById('myDiv').textContent = 'New text!';
document.querySelector('.myClass').style.color = 'red';
```
- **Event Listeners:**
```js
document.getElementById('myBtn').addEventListener('click', function() {
  // code to run on click
});
```
- **Variables and Functions:**
```js
let count = 0;
function increment() {
  count++;
  console.log(count);
}
```

## 4. Useful Resources
- [MDN Web Docs](https://developer.mozilla.org/)
- [W3Schools](https://www.w3schools.com/)
- [freeCodeCamp](https://www.freecodecamp.org/)

---
This guide covers the basics. For more, check the resources above or ask for specific examples!
