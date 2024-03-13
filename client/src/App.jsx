import React, { useState } from 'react';

function App() {
  const [question, setQuestion] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleQuestionChange = (event) => {
    setQuestion(event.target.value);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);
  
    const response = await fetch('http://localhost:3000/split', {
      method: 'POST',
      body: formData,
    });
    
    if (response.ok) {
      const data = await response.json();
      setResult(data);
    } else {
      if (response.status === 400) {
        // Handle 400 error
        console.error('Bad request');
        // You can also try to parse the response to get more details about the error
        const errorData = await response.text();
        console.error('Error details:', errorData);
      } else {
        // Handle other errors
        const errorData = await response.text();
        console.error(`Error ${response.status}:`, errorData);
      }
    }
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit}>
        <label>
          Question:
          <input type="text" value={question} onChange={handleQuestionChange} />
        </label>
        <label>
          File:
          <input type="file" onChange={handleFileChange} />
        </label>
        <button type="submit">Submit</button>
      </form>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

export default App;