require('dotenv').config();
const cheerio = require("cheerio");
const { Document } = require("langchain/document");
const {formatDocumentsAsString} = require("langchain/util/document");
const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");
const { RunnableSequence, RunnablePassthrough } = require("@langchain/core/runnables");
const express = require('express');
const cors = require('cors');
const mammoth = require('mammoth');
const app = express();
app.use(cors()); 
const port = 3000;
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });
const pdfParse = require('pdf-parse');

const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
Context:
{context}

Question: {question}

Helpful Answer:`;

const prompt = PromptTemplate.fromTemplate(template);



const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
const titleSelector = "title";
const metaDescriptionSelector = "meta[name=description]";
const h1TagSelector = "h1";
const h2TagSelector = "h2";
const h3TagSelector = "h3";
const pTagSelector = "p";
const loader = new CheerioWebBaseLoader(
    "https://webmarketsonline.com/",
    {
        selector: `${titleSelector},${metaDescriptionSelector},${h1TagSelector},${h2TagSelector},${h3TagSelector},${pTagSelector}`,
        
    }
);


app.post('/split', upload.single('file'), async (req, res) => {  
  try {
    let text;
    let file = req.file;
    // let filePath = handleFilePath(req.file.path);
    let filePath = req.file.path;
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (file.mimetype === 'text/plain' || file.mimetype === 'application/msword') {
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    
    // console.log('Text:', text);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 250,
    });
    let splits = text.split('\n').filter(str => str.trim() !== '').map(str => ({ content: str })); // or use the appropriate delimiter
    
    splits = await textSplitter.createDocuments([text]);
    
    const vectorStore = await MemoryVectorStore.fromDocuments(splits, new OpenAIEmbeddings());
    const retriever = vectorStore.asRetriever();
    
    const ragChain = await createStuffDocumentsChain({
      llm,
      prompt,
      outputParser: new StringOutputParser(),
    });
    
    const retrievedDocs = await retriever.getRelevantDocuments(
      req.body.question,
    );

    const answer = await ragChain.invoke({
      question: req.body.question,
      context: retrievedDocs,
    });
    // const answer = await chain.invoke(req.body.question);
    console.log('Answer:', answer);

    res.status(200).json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
  
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});