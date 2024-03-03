const db = require("./db");
const { PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const AWS = require("aws-sdk");

module.exports.handler = async (event) => {
  console.log(event);

  const response = { statusCode: 200 };
  try {
    const body = JSON.parse(event.body);

    // Generate post ID by using UUID generator.
    const crypto = require("crypto");
    const postId = crypto.randomUUID();

    // Call AssetManager service's s3-post-image-uploader to retrieve signedUrl and imageId.
    const assetManagerPostImageUploadLambda = new AWS.Lambda({
      region: "ap-south-1",
    });

    const assetManagerParams = {
      FunctionName: "s3-file-uploader",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({
        pathParameters: {
          postId: postId,
        },
        queryStringParameters: {
          fileExtension: "jpeg",
        },
      }),
    };

    const assetManagerPostImageUploadLambdaResponse =
      await assetManagerPostImageUploadLambda
        .invoke(assetManagerParams)
        .promise();

    console.log(JSON.parse(assetManagerPostImageUploadLambdaResponse.Payload));

    const responseBody = JSON.parse(
      JSON.parse(assetManagerPostImageUploadLambdaResponse.Payload).body
    );

    const userId = event.pathParameters.userId;

    const itemToBeStored = {
      postId: postId,
      userId: userId,
      fileExtensions: "jpeg",
      createTime: new Date().toISOString(),
    };

    const params = {
      TableName: process.env.DYNAMODB_POSTS_TABLE_NAME,
      Item: marshall(itemToBeStored, { removeUndefinedValues: true }),
    };
    const createResult = await db.send(new PutItemCommand(params));

    response.body = JSON.stringify({
      message: "Successfully created post.",
      postId: postId,
      post: itemToBeStored,
    });
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to create post.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }
  return response;
};
