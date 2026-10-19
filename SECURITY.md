# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for a security problem.

Include what you found, how to reproduce it, and which version you used. You will get an answer within a week.

## Supported versions

Fixes go into the latest release. drillplot is pre-1.0, so update to the newest version to get a fix.

## What is in scope

drillplot renders SVG from a source document and reopens SVG it exported. A source or SVG that makes the renderer emit markup it should not, or makes the editor run script, is in scope.
