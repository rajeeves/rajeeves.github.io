# rajeev.erramil.li

Text lives in `content/`, the page template and scripts in `src/`, and the build scripts in `tools/`.
Papers come from INSPIRE and repository info from the GitHub/GitLab APIs (cached in `data/`).

    npm ci
    pip install -r requirements.txt
    ./build.sh            # or ./build.sh --offline to skip the fetches
    python3 -m http.server -d out

Pushing to `main` builds the site and deploys it to the `gh-pages` branch.
