# FinclarityAI - Build Process Commit History

This document outlines the systematic build process used during the ET AI Hackathon 2026. The commit history reflects our journey from the initial project scaffolding to integrating advanced Generative AI features and preparing the final submission.

## 🛠️ Step 1: Ideation & Setup
`chore: init GenAI hackathon project structure`
- Set up the main repository structure.
- Initialized a Python virtual environment and created the `requirements.txt`.
- Configured `.gitignore` to secure API keys and sensitive data.

## 🔒 Step 2: Backend Architecture & Authentication
`feat(backend): setup robust Flask backend with Supabase auth`
- Built the core Flask application and configured routes.
- Integrated the Supabase client.
- Implemented secure API endpoints for Email/Password Signup/Login and Google OAuth integration.

## 🧠 Step 3: GenAI Integration
`feat(ai): integrate OpenAI API for intelligent financial assistant`
- Created the `chat.py` blueprint.
- Integrated the OpenAI GPT-4 API to drive the conversational AI assistant.
- Engineered prompt instructions specifically tailored for complex financial queries.

## 💾 Step 4: Data Persistence
`feat(db): establish persistent user chat memory via Supabase`
- Configured a `user_data` table in Supabase.
- Implemented logic to actively save and sync user chat histories.
- Ensured the AI remembers financial context across different login sessions.

## 🎨 Step 5: UI/UX Polish
`feat(ui): design intuitive dashboard and seamless chat interface`
- Designed the main application dashboard utilizing dynamic Glassmorphism aesthetics.
- Developed an interactive front-end comparing real-time financial products.
- Connected the financial calculators seamlessly to the UI.

## 🚀 Step 6: Finalization
`chore: finalize AI features and prep for hackathon submission`
- Conducted final bug scraping and error handling fixes.
- Ensured environment variables and Supabase schema are stable.

## 📝 Step 7: Documentation
`docs: finalize ET AI Hackathon 2026 submission artifacts`
- Authored a comprehensive `README.md` defining setup instructions and team details.
- Cleaned and organized the repository for final submission to the hackathon judges.


## 📜 Comprehensive Commit History

```text
commit 1ec6dceda7765af6473a88399d356abf60bcb61c
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:46:26 2026 +0530

    docs: link new markdown timeline

commit 2503e39a87a2aa5070757d9c54cbfb67a024b74b
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:46:07 2026 +0530

    docs: replace raw txt commit log with beautiful markdown timeline for hackathon

commit 83db95d74eef8a76a099a2093089974889f90dbe
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:43:03 2026 +0530

    docs: finalize ET AI Hackathon 2026 submission artifacts

commit b1a79966f1a18bf9bead7fa5e7ee106be5c00376
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:24:03 2026 +0530

    chore: refresh build process log

commit 4c08ef22a94f416793adc91959df623798897f5d
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:24:03 2026 +0530

    docs: update README with hackathon focus

commit 1d96801a7b63ac1a29385d26972b45cb8163296a
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:23:19 2026 +0530

    docs: finalize GenAI hackathon README and build logs

commit 5d392b1f5e4f2369d4bc8e4e6b825c9d3b01e9b8
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:22:35 2026 +0530

    chore: finalize AI features and prep for hackathon submission

commit 37b9fa04b09b689953e4a6bc3aea1068b08d0aa6
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:22:35 2026 +0530

    feat(ui): design intuitive dashboard and seamless chat interface

commit 55c39fdec64b6fa92aafad0d6ee26760f7327378
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:22:35 2026 +0530

    feat(db): establish persistent user chat memory via Supabase

commit 2617775bc19e8ebf176991c7e503cbf8e29ce439
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:22:35 2026 +0530

    feat(ai): integrate OpenAI API for intelligent financial assistant

commit 8d95c4f97ed4799dbfcf1ee20c1ab5fb226844bc
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:22:35 2026 +0530

    feat(backend): setup robust Flask backend with Supabase auth

commit fe7c80ea1c040488f964437888593719a3d3235c
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 23:22:35 2026 +0530

    chore: init GenAI hackathon project structure

commit 8a5b5ef195290ae83300dba2919dbf9c364a00e7
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 26 22:48:46 2026 +0530

    restore history

commit 127c5f0864a19be71d58857f26021fc77382bc4c
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 26 17:28:34 2026 +0530

    breadcrumb navigation fixed

commit 17f6cd13c0df43d0b7b461d0dcc4a6b131c2542c
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 26 13:56:54 2026 +0530

    Chinese Removed

commit 279666ca059546962b3f88afc5d08801ab258bc7
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 26 13:19:38 2026 +0530

    chat.py updated

commit d100fe5ecfe83b7497e2ff0ca1c4f9d6174d76db
Merge: 18d7b97 b8f2753
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Thu Mar 26 02:37:28 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI

commit 18d7b9718d460d8fdaf84c705a952a97a00dd1ca
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Thu Mar 26 02:32:38 2026 +0530

    Reformed home page, linked database to documents, reformed compare section, Added financial calculators, changed delete button

commit b8f275353a89e76802ee99d43f974be5de8d7c5b
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Wed Mar 25 22:32:38 2026 +0530

    chat bot updated

commit 6dbe05dca7e4952570c99cd94bccd5eacde921ba
Merge: 1fc4a83 045f692
Author: Abhi <anu01857@gmail.com>
Date:   Tue Mar 24 22:35:56 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI

commit 1fc4a8399416728fa055f0ee4b66e911ed714f48
Author: Abhi <anu01857@gmail.com>
Date:   Tue Mar 24 22:35:48 2026 +0530

    compare section

commit 045f6923617e89eb4e412a5857d5d45a60855c6b
Merge: 94048f4 c73e9be
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Tue Mar 24 21:29:04 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI

commit 94048f4bd79a0bd83bf0aa659a58c9a9654c80d7
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Tue Mar 24 21:21:06 2026 +0530

    scrapper done

commit 3c4bf28db688e3b175a24ec3abd068fd50746707
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Mon Mar 23 20:27:59 2026 +0530

    error handling made global# Please enter the commit message for your changes. Lines starting

commit c73e9bed4cd9e617a6221d17db55b9d46ae9048e
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Mon Mar 23 20:25:22 2026 +0530

    fixed llm

commit bad1d6bab371c57a51fc7ebb775343994ad15f68
Merge: 2f53ac8 cdf9eb8
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sun Mar 22 23:32:51 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI into ychanges

commit cdf9eb87715a8532fdbfc7511cc6be5297862e72
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sun Mar 22 20:57:47 2026 +0530

    FINALLLYLYYYYYYYYYYYYYYYYYYYYYYYY DONEEEEEEEEEEEE

commit ad4f0d594c0e9404dfed66b4a1f7d745283e6d5f
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sun Mar 22 20:33:04 2026 +0530

    sorted sign-in/sign-up with bunch of features in dasdhboard

commit 72bd091153c6c90ca7edd04213fbe5b7015dd51c
Merge: f56df4f 826aa56
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sun Mar 22 16:45:19 2026 +0530

    commiting for pull

commit f56df4fc239dd3da5cbc2df53585a0e1bdaabc31
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sun Mar 22 16:42:24 2026 +0530

    commiting for pull

commit 826aa56e66346ee3ed90f7ab9b99cb6b4dcb70e3
Merge: 0d9daf3 eeae80c
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sun Mar 22 16:41:16 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI

commit 0d9daf32961e598491f862585ebf319a79c85260
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sun Mar 22 16:38:29 2026 +0530

    database sorted

commit eeae80ce679bcd42983c3fa8c05dd08e3b2a9e35
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sun Mar 22 11:43:01 2026 +0530

    ChatBot Done

commit 2c166cc1b9603c4df02f25a5cb4c7a8c4fa48afc
Merge: 52c428a 1ba2aa4
Author: Abhi <anu01857@gmail.com>
Date:   Sat Mar 21 22:15:16 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI

commit 52c428abb588b33dc8cf39976421e74d0551d9ad
Author: Abhi <anu01857@gmail.com>
Date:   Sat Mar 21 22:15:11 2026 +0530

    fixed

commit 1ba2aa4d91e499a96fedbe4d4cb33c8d388ba9c4
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 22:09:53 2026 +0530

    ChatBort Working

commit d37b73e260cb3b2276102fbcb9946ad5eb6705e7
Merge: 61582d7 21d46b4
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 21:42:03 2026 +0530

    updated deployment setup

commit 61582d7bea23e7c211fbd9bdad0ebf82a89b5911
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 21:32:41 2026 +0530

    error detection for deployment

commit 21d46b4da7eb70a5e7f5eb6eeeb35de53f776375
Author: Abhi <anu01857@gmail.com>
Date:   Sat Mar 21 21:30:39 2026 +0530

    formatting

commit 78830b59d641a4947c2f594901e0c8482b7fb75c
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 21:04:50 2026 +0530

    Requirements updated

commit 2f1cfd100efd9001a0852663118c1f59756578b8
Author: Abhi <anu01857@gmail.com>
Date:   Sat Mar 21 20:11:45 2026 +0530

    human response

commit bbeab637e302a05cc25c9c865fbaea60b1b00f7f
Author: Abhi <anu01857@gmail.com>
Date:   Sat Mar 21 20:03:19 2026 +0530

    streamenable type shi8

commit 7e19be3711e3b68be3ec4df0a80521004c2a6c50
Merge: 8726a69 f2b2dbe
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 18:23:19 2026 +0530

    ChatBot updated

commit 8726a6932628cb4641b30ae45cf65338dbec569e
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 18:20:26 2026 +0530

    ChatBot updated

commit 2f53ac865a66efcb602f2c06aefc1fcdf9fa374f
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sat Mar 21 17:51:57 2026 +0530

    targets removed

commit f2b2dbe375a942efca002be38f8bad5161fffec3
Merge: cc15043 6c690bd
Author: Yuvi-bansal <Yuvishbansal894@gmail.com>
Date:   Sat Mar 21 17:37:24 2026 +0530

    Merge pull request #4 from itz-shiven/ychanges
    
    scrapper work done

commit 6c690bddab64fcc319190903db56bb8b5d2bf722
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sat Mar 21 17:28:36 2026 +0530

    final scrapper added

commit 46f88e0c081b857406eb64a461b9db8789415c48
Merge: 52debe4 cc15043
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sat Mar 21 17:28:24 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI into ychanges

commit 52debe42a0af389b3af08722daa51270a95358fb
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sat Mar 21 15:09:11 2026 +0530

    scrapper added

commit cc1504363846b101b8f307a82e00f254a786fc26
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sat Mar 21 15:09:06 2026 +0530

    added llm which responds with Database

commit 30742c7208220310895306c691740b5150e65a4d
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sat Mar 21 12:45:23 2026 +0530

    changed theme of project

commit 5ac9d1002c45583176ebb0e0cfc36beade2c03db
Merge: c99b1e4 5990a46
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Sat Mar 21 11:27:33 2026 +0530

    Merge branch 'main' of https://github.com/itz-shiven/finclarityAI into ychanges

commit 5990a46db18cb382d7772b1120f8439f6c21424f
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Sat Mar 21 03:56:10 2026 +0530

    updated dashbooard with lot of features

commit b2146c9c6f6916122d14f4b246d713acf007b9a6
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 02:17:39 2026 +0530

    profile button added

commit d51545afdef9c4329a518ffcf49a0392a5bcc9f9
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 02:03:25 2026 +0530

    setting icon fix

commit 8192d8b5d60c14bcbf3113c687913364136ec2b6
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 01:42:54 2026 +0530

    Dashboard Fix

commit 79849fadc79018174a7524197cbc96e2f4fed58e
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Sat Mar 21 01:36:19 2026 +0530

    Dashboard

commit ecbecfe8d9f6355044f68731304278bff855b09a
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Fri Mar 20 16:30:25 2026 +0530

    final google

commit cb186c6c84d86035dbe36837551134af267f511e
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Fri Mar 20 15:34:58 2026 +0530

    google fix

commit c99b1e4ab7e9aae4dd142773e059aa1bd3f8ad6b
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Fri Mar 20 14:12:11 2026 +0530

    corrected

commit 592e8982c862b5551a4f06cff897235883960bcf
Author: Yuvish <yuvishbansal894@gmail.com>
Date:   Fri Mar 20 14:00:13 2026 +0530

    first change

commit d307fbccc4a92d9bdcf30ce89243de20185fc466
Author: Abhi <anu01857@gmail.com>
Date:   Fri Mar 20 00:00:37 2026 +0530

    o auth redirect fix try1

commit a8a70707c701d5f1e99bdb4f96cbc6a68642b584
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 19 23:49:59 2026 +0530

    dashboard redirecting fixed

commit a6f914d191f1e6a406f65762a4a75b11a4bf2853
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 19 23:30:58 2026 +0530

    dashboard fix

commit e7fbf793da67fe818441e52df8dc3e7452d3a4c0
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 19 23:27:47 2026 +0530

    o auth processing

commit 30cb4adcaa40bb640e88d5c48b0fd444268bcff3
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Thu Mar 19 22:14:30 2026 +0530

    partial_google_auth

commit b49faa240c01a1ca0c27889273faf3994874bd38
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 19 20:20:25 2026 +0530

    Requirment updated

commit 3a299784ed611e7a34b77a5171132ff4b2e9034d
Merge: dcde4b2 82cd7e4
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 19 20:05:57 2026 +0530

    IDK

commit 82cd7e43246e17d4eafcc12a8dd2c2e6a947b52e
Author: Abhi <anu01857@gmail.com>
Date:   Thu Mar 19 16:41:05 2026 +0530

    uptime robot

commit dcde4b25782d523b9ccbf638d8adc414a031e53c
Merge: 99ec0f9 1e62aba
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 19 00:03:43 2026 +0530

    updated requirements.txt

commit 99ec0f9805cb7636911837cc9d047a33bbd086bb
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Thu Mar 19 00:00:19 2026 +0530

    Upadated requirements.txt

commit 1e62aba34904a38bcdc1fb30480e55811b3a9b1e
Author: Abhi <anu01857@gmail.com>
Date:   Wed Mar 18 22:43:27 2026 +0530

    it works

commit 6e2cc003d94c434c5d7cd43561e9692d772232a6
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Wed Mar 18 22:14:45 2026 +0530

    added .env to gitignore

commit f6506ae1cd5411fe6177cf1ece09936d28c5281f
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Wed Mar 18 20:55:47 2026 +0530

    connecting to supabase

commit 6753400153c60f2e63b4ecefcb7add6699b68bbe
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Wed Mar 18 18:24:32 2026 +0530

    updated app.py

commit aed9ebe8a9e379d1c941290913a7036367684e90
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Wed Mar 18 18:10:48 2026 +0530

    added gunicorn

commit b62147e597e2674631995e734d5db71f1b4ebde4
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Wed Mar 18 17:59:31 2026 +0530

    Cloud Deployment Architecture

commit ec4e89f53421b643287210b020522ccc87856bc4
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Wed Mar 18 03:06:26 2026 +0530

    Flask server made

commit a18f2030bd6a4f64a167070b5088684d2502014a
Author: it-shiven <shivengoyal2007@gamail.com>
Date:   Wed Mar 18 00:14:24 2026 +0530

    animation added

commit a5b9d30e733a1ee9b03ca67ec87e071cd057fb03
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Tue Mar 17 00:36:11 2026 +0530

    removed demo button

commit d57a551bfcb111580aada432d489efcbfa423459
Author: Varun Arora <varunarora242424@gmail.com>
Date:   Tue Mar 17 00:10:26 2026 +0530

    Added Basic Files

commit 5795225a4c0c992ee64af20c58395174d960867a
Author: itz-shiven <shivengoyal2007@gmail.com>
Date:   Mon Mar 16 23:50:01 2026 +0530

    Initial commit

```
