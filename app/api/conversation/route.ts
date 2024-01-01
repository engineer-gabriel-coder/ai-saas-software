import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";

import { checkSubscription } from "@/lib/subscription";
import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export default async function handler(req: Request) {
  try {
    // Destructure user ID directly from auth() result
    const { userId } = auth();

    // Validate if user is authenticated
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if the OpenAI API key is configured
    if (!configuration.apiKey) {
      return new NextResponse("OpenAI API Key not configured.", {
        status: 500,
      });
    }

    // Destructure messages directly from the request body
    const { messages } = await req.json();

    // Check if messages are provided in the request
    if (!messages) {
      return new NextResponse("Messages are required", { status: 400 });
    }

    // Check the user's subscription status and free trial status
    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    // Handle subscription status
    if (!freeTrial && !isPro) {
      return new NextResponse(
        "Free trial has expired. Please upgrade to pro.",
        { status: 403 }
      );
    }

    // Create chat completion using the OpenAI API
    const response = await openai.createChatCompletion({
      messages: [{ role: "system", content: "You are a helpful assistant." }],
      model: "gpt-3.5-turbo",
    });

    // Increment API limit if the user is not subscribed
    if (!isPro) {
      await incrementApiLimit();
    }

    // Return the chat completion as JSON in the HTTP response
    return NextResponse.json(response.data.choices[0].message);
  } catch (error) {
    // Log errors for debugging
    console.error("[CONVERSATION_ERROR]", error);
    // Return a generic error response
    return new NextResponse("Internal Error", { status: 500 });
  }
}
