const fs = require('fs');
const token = process.env.SLACK_BOT_TOKEN     // 引入環境變數拿取 token
const sendingChannel = 'diver-github-notify'      // 到哪個 slack 頻道發布訊息 (僅限公開頻道)
const { WebClient, LogLevel } = require("@slack/web-api");
const { exitCode } = require('process');
const client = new WebClient(token, {
  logLevel: LogLevel.DEBUG
});

fs.readFile('newman-report.json', 'utf8', (err, data) => {
  if (err) {
    console.error("Error reading file:", err);
    return;
  }

  try {
    const report = JSON.parse(data);
    let element_blocks = [];
		
		// 從 'newman-report.json' 搜集 status code 為 400~600 的結果
		// 因此 postman 的 test script 要以返回 status code 為重點！
    report.run.executions.forEach(execution => {
      const apiName = execution.item.name;
      const responseCode = execution.response.code;
      const assertions = execution.assertions;
      assertions.forEach(assertion => {
        if ("error" in assertion) {
          // const path = `${execution.request.url.path.join('/')}`;
          // const method = execution.request.method;
          const url = `${execution.request.url.protocol}://${execution.request.url.host.join('.')}/${execution.request.url.path.join('/')}`;
          const message = assertion.error.test
          element_blocks.push(
            {
              "type": "context",
              "elements": [
                {
                  "type": "mrkdwn",
                  "text": `*Name:*\t\n${apiName}\t`
                },
                {
                  "type": "mrkdwn",
                  "text": `*Status code:*\t\n${responseCode}\t`
                },
                {
                  "type": "mrkdwn",
                  "text": `*Error Message:*\t\n${message}\t`
                },
                {
                  "type": "mrkdwn",
                  "text": `*Url:*\t\n${url}\t`
                }
              ]
            },
            {
              "type": "divider"
            }
          );
        }
      })
      
    });

    let testResult;
    let reportColor;
    if (element_blocks.length > 0) {
      console.log(`Failed report: ${element_blocks}`)
      testResult = 'Failed';
      reportColor = '#ff0000';
    } else {
      console.log('No failed tests to report.')
      testResult = 'Success';
      reportColor = '#36a64f';
    }
    const blocks = [
      {
        "color": '#36a64f',
        "blocks": [
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*From Branch:*\n" + process.env.BRANCH
              },
              {
                "type": "mrkdwn",
                "text": "*Status:*\nsuccess"
              }
            ]
          },
          {
            "type": "divider"
          }
        ]
      },
      {
        "color": reportColor,
        "blocks": [
          {
            "type": "rich_text",
            "elements": [
              {
                "type": "rich_text_section",
                "elements": [
                  {
                    "type": "text",
                    "text": "API Test "
                  },
                  {
                    "type": "text",
                    "text": testResult + "!",
                    "style": {
                      "bold": true
                    }
                  }
                ]
              }
            ]
          },
          {
            "type": "divider"
          }
        ].concat(element_blocks)
      }
    ]
    sendAndPublishMessage(sendingChannel, blocks);
  } catch (err) {
    console.error("Error parsing JSON:", err);
  }
});

async function sendAndPublishMessage(sendingChannel, payload) {
  try {
    const id = process.env.SLACK_CHANNEL_ID;
    if (id) {
      await publishMessage(token, id, payload);
    } else {
      console.log('No conversation found for channel:', sendingChannel);
    }
  } catch (error) {
    console.error('Error in sendAndPublishMessage:', error);
  }
}


async function publishMessage(token, id, blocks) {
  try {
    const ts = process.env.SLACK_MESSAGE_TS;
    const result = await client.chat.update({
      token,
      ts,
      channel: id,
      attachments: blocks,
      text: process.env.DEPLOY_ENV + process.env.SLACK_MESSAGE_TITLE
    });
    console.log('publishMessage:\n'+result);
  }
  catch (error) {
    console.error(error);
  }
}