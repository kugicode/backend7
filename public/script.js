const button = document.getElementById('btn');
const paragraph = document.getElementById('text');
const button2 = document.getElementById('btn2');
const secondParagraph = document.getElementById('text2');

button.addEventListener('click', async () => {
  try {
    const response = await fetch('/first');

    if (response.ok) {
      let responseData = await response.text(); // Backend sends plain text
      console.log(responseData);
      paragraph.textContent = responseData;
    } else {
      console.log("HTTP Error: " + response.status);
      paragraph.textContent = `Error: ${response.status} - Could not connect to backend.`;
    }
  } catch (error) {
    console.error("An error has occurred!", error);
    paragraph.textContent = `An error occurred: ${error.message}`;
  }
});

button2.addEventListener('click', async () => {
  const response = await fetch('/second');
try{
  if (response.ok){
    let responseData = await response.text();
    console.log(responseData);
    secondParagraph.textContent = responseData;
  }
  else{
    console.log("HTTP error" + response.status);
    secondParagraph.textContent = "An error has occured!", response.status;
  }
}
catch(error){
console.log("An error has occured!", error);
secondParagraph.textContent = "An error has occured!", error.message;
}
});