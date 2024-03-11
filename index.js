require('dotenv').config();
const cheerio = require("cheerio");
const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { pull } = require("langchain/hub");

const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

const { PromptTemplate } = require("@langchain/core/prompts");
const { createStuffDocumentsChain } = require("langchain/chains/combine_documents");

const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.

{context}

Question: {question}

Helpful Answer:`;

const customRagPrompt = PromptTemplate.fromTemplate(template);

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

async function loadAndLog() {
    const docs = await loader.load();
    // console.log(docs[0].pageContent);
 
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const allSplits = await textSplitter.splitDocuments(docs);

    const vectorStore = await MemoryVectorStore.fromDocuments(
      allSplits,
      new OpenAIEmbeddings({
        openAIApiKey:process.env.OPENAI_API_KEY,
        
        }),
    );
    const retriever = vectorStore.asRetriever({ k: 6, searchType: "similarity" });
    const ragChain = await createStuffDocumentsChain({
        llm,
        prompt: customRagPrompt,
        outputParser: new StringOutputParser(),
      });
      const context = await retriever.getRelevantDocuments(
        "what is task decomposition"
      );
      
      await ragChain.invoke({
        question: "What is Task Decomposition?",
        context,
      });
      console.log(context);
}
 
 loadAndLog();