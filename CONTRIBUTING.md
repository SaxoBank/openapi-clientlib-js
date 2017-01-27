# Contributing
The OpenAPI JS Connector is an Open Source Project [licensed under the Apache 2.0 License](LICENSE). 
We happily accept Pull Requests, so here are a few guidelines to get you started. 
## Getting Started

* Make sure you have a [GitHub account](https://github.com/signup/free)
* Submit [a ticket](https://github.com/saxobank/openapi-connector-js/issues) for your issue, assuming one does not already exist.
    *  Clearly describe the issue including steps to reproduce when it's a bug
    *  Make sure you fill in the earliest version that you know as the issue
* Fork the repository on GitHub

## Making Changes

* Optionally create a topic branch from where you want to base your work.
  * This is usually the master branch.
  * Only target release branches if you are certain your fix must be on that
    branch.
* Make commits of logical units.
* Check for unnecessary whitespace with `git diff --check` before committing.
* Make sure your commit messages are in the proper format:

````
    Make the example in CONTRIBUTING imperative and concrete

    Without this patch applied the example commit message in the CONTRIBUTING
    document is not a concrete example.  This is a problem because the
    contributor is left to imagine what the commit message should look like
    based on a description rather than an example.  This patch fixes the
    problem by making the example concrete and imperative.

    The first line is a real life imperative statement.
    The body describes the behavior without the patch, why this is a problem, 
    and how the patch fixes the problem when applied. And lastly, if the commit
    resolves a specific issue, reference that  at the bottom.
    
    Fixes #12
````

* Make sure you have added the necessary tests for your changes.
* Run _all_ the tests to assure nothing else was accidentally broken.

## Submitting Changes

* Push your changes to a topic branch in your fork of the repository.
* Submit a pull request to the repository in the SaxoBank organization.
* The core team looks at Pull Requests on a regular basis.
* After feedback has been given we expect responses within two weeks. After two
* weeks we may close the pull request if it isn't showing any activity.

Happy committing!
