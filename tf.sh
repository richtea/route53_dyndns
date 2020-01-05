#!/usr/bin/env bash

usage() {
    echo "Usage: $0 [-s <target-stack>] -c <command>"
    echo "command: apply | plan"
    exit 0
}

stack="default"
input=""

while getopts ":hys:c:" arg; do
  case $arg in
    c) # Specify terraform command.
      command=${OPTARG}
      ;;   
    s) # Specify target stack.
      stack=${OPTARG}
      ;;
    y) # Suppress input prompts
      input="-input=false"
      ;;
    h | *) # Display help.
      usage
      exit 0
      ;;
  esac
done

scriptdir=$( dirname "${BASH_SOURCE[0]}" )

if [ "$input" != "" ] && [ "$command" = "apply" ]; then
  input="$input -auto-approve"
fi

echo "Using workspace ${stack}"
export TF_WORKSPACE=${stack}

eval "terraform $command -var-file=${scriptdir}/terraform/${stack}.tfvars ${input}"
