#!/bin/bash
function get_package_property() {
  echo $(cat ./package.json \
  | grep $1 \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
}

CURRENT_VERSION=$(get_package_property version)

VERSION_MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
VERSION_MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
VERSION_PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)


CURRENT_IOS_VERSION="$VERSION_MAJOR$(printf '%02d\n' $VERSION_MINOR)$(printf '%02d\n' $VERSION_PATCH)"

if [ -z "$1" ]  || ["$1" = "patch" ]; then
  VERSION_PATCH=$((VERSION_PATCH + 1))
elif [ "$1" = "minor" ]; then
  VERSION_MINOR=$((VERSION_MINOR + 1))
  VERSION_PATCH=0
elif [ "$1" = "major" ]; then
  VERSION_MAJOR=$((VERSION_MAJOR + 1))
  VERSION_MINOR=0
  VERSION_PATCH=0
fi


NEW_VERSION="$VERSION_MAJOR.$VERSION_MINOR.$VERSION_PATCH"
NEW_IOS_VERSION="$VERSION_MAJOR$(printf '%02d\n' $VERSION_MINOR)$(printf '%02d\n' $VERSION_PATCH)"

echo "Bumping current version $CURRENT_VERSION ($CURRENT_IOS_VERSION) to $NEW_VERSION ($NEW_IOS_VERSION)"
if [[ $OSTYPE == 'darwin'* ]]; then
  sed -i '' "s/version\: \'$CURRENT_VERSION\'/version\: \'$NEW_VERSION\'/" src/environments/environment.prod.ts
  sed -i '' "s/version\: \'$CURRENT_VERSION-dev\'/version\: \'$NEW_VERSION-dev\'/" src/environments/environment.ts

  # Update iOS versions
  sed -i '' "s/\<string\>v$CURRENT_VERSION\<\/string\>/\<string\>v$NEW_VERSION\<\/string\>/" ios/App/App/Settings.bundle/Root.plist
  sed -i '' "s/MARKETING_VERSION \= $CURRENT_VERSION;/MARKETING_VERSION \= $NEW_VERSION;/" ios/App/App.xcodeproj/project.pbxproj
  sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_IOS_VERSION;/CURRENT_PROJECT_VERSION = $NEW_IOS_VERSION;/" ios/App/App.xcodeproj/project.pbxproj

  # Update package version
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\",/\"version\": \"$NEW_VERSION\",/" package.json
else
  sed -i "s/version\: \'$CURRENT_VERSION\'/version\: \'$NEW_VERSION\'/" src/environments/environment.prod.ts
  sed -i "s/version\: \'$CURRENT_VERSION-dev\'/version\: \'$NEW_VERSION-dev\'/" src/environments/environment.ts

  # Update iOS versions
  sed -i "s/\<string\>v$CURRENT_VERSION\<\/string\>/\<string\>v$NEW_VERSION\<\/string\>/" ios/App/App/Settings.bundle/Root.plist
  sed -i "s/MARKETING_VERSION \= $CURRENT_VERSION;/MARKETING_VERSION \= $NEW_VERSION;/" ios/App/App.xcodeproj/project.pbxproj
  sed -i "s/CURRENT_PROJECT_VERSION = $CURRENT_IOS_VERSION;/CURRENT_PROJECT_VERSION = $NEW_IOS_VERSION;/" ios/App/App.xcodeproj/project.pbxproj

  # Update package version
  sed -i "s/\"version\": \"$CURRENT_VERSION\",/\"version\": \"$NEW_VERSION\",/" package.json
fi

